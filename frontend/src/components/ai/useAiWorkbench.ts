'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { getTree } from '@/utils/share/getTree'
import { updateShare } from '@/utils/share/put'
import postVM from '@/utils/vms/fetch/postVM'
import normalizeClient from '@/components/gpt/normalizeClient'
import { aiClientRequest } from '@/utils/ai/client'
import { importRepositoryToShare } from '@/utils/ai/importRepositoryToShare'
import { scaffoldNextjsDockerWorkspace } from '@/utils/ai/scaffoldWorkspace'
import { syncRepositoryToShare } from '@/utils/ai/syncRepositoryToShare'
import { attachGitHubCredential, importGitHubRepository, removeGitHubCredential } from './github'
import { listTreePaths } from './shareTree'
import {
    appendError,
    buildSystemPrompt,
    buildWorkspaceContext,
    chooseNewestFailure,
    chooseNewestToolRun,
    createConversation,
    createWorkbenchSocket,
    deriveLastFailure,
    deriveLastToolState,
    parseToolCalls,
    resolveModelName,
    slugify,
    stripToolTags,
    toConversationPayload,
    type AiToolCall,
    withRepositorySync,
    withWorkspaceActivity,
} from './workbench/helpers'
import { useConversationActions } from './workbench/useConversationActions'
import { useShareWorkspaceState } from './workbench/useShareWorkspaceState'

type UseAiWorkbenchProps = {
    initialConversations: AIConversation[]
    initialRepositories: AIImportedRepo[]
    initialDeployments: AIDeployment[]
    initialReleases: AIRelease[]
    initialDeployQuota: AIDeployQuota | null
    initialOwnershipSummary: AIOwnershipSummary | null
    initialShares: Share[]
    initialRuntimeState: AIRuntimeState | null
    isAuthenticated: boolean
    initialConversationId?: string | null
}

export default function useAiWorkbench({
    initialConversations,
    initialRepositories,
    initialDeployments,
    initialReleases,
    initialDeployQuota,
    initialOwnershipSummary,
    initialShares,
    initialRuntimeState,
    isAuthenticated,
    initialConversationId = null,
}: UseAiWorkbenchProps) {
    const socketRef = useRef<WebSocket | null>(null)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const shouldReconnectRef = useRef(true)
    const bootstrappedRef = useRef(false)
    const conversationsRef = useRef<AIConversation[]>(initialConversations)
    const createNewConversationRef = useRef<() => Promise<void>>(async () => {})
    const hydrateShareRef = useRef<(shareId: string) => Promise<Share | null>>(async () => null)
    const hydrateShareFileRef = useRef<(rootId: string, filePath: string) => Promise<string | null>>(async () => null)
    const handleSocketMessageRef = useRef<(message: GptSocketMessage) => void>(() => {})
    const executeAssistantToolsRef = useRef<(conversation: AIConversation, message: AIConversationMessage) => Promise<void>>(async () => {})
    const runToolCallRef = useRef<(conversation: AIConversation, toolCall: AiToolCall) => Promise<{ ok: boolean, message: string }>>(async () => ({ ok: false, message: 'Tool unavailable.' }))
    const refreshRuntimeRef = useRef<() => Promise<void>>(async () => {})
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [participants, setParticipants] = useState(initialRuntimeState?.connectedClientCount || 0)
    const [isConnected, setIsConnected] = useState(Boolean(initialRuntimeState?.connectedClientCount))
    const [statusNotice, setStatusNotice] = useState<string | null>(initialRuntimeState?.lastFailure?.message || null)
    const [runtimeSnapshot, setRuntimeSnapshot] = useState<AIRuntimeState | null>(initialRuntimeState)
    const [conversations, setConversations] = useState<AIConversation[]>(initialConversations)
    const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || initialConversations[0]?.id || null)
    const [composer, setComposer] = useState('')
    const [search, setSearch] = useState('')
    const [importInput, setImportInput] = useState('')
    const [githubToken, setGitHubToken] = useState('')
    const [importError, setImportError] = useState<string | null>(null)
    const [importPending, setImportPending] = useState(false)
    const [collaborationError, setCollaborationError] = useState<string | null>(null)
    const [collaboratorPending, setCollaboratorPending] = useState(false)
    const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null)
    const [importedRepos, setImportedRepos] = useState<AIImportedRepo[]>(initialRepositories)
    const [deployments, setDeployments] = useState<AIDeployment[]>(initialDeployments)
    const [deployPending, setDeployPending] = useState(false)
    const [releases, setReleases] = useState<AIRelease[]>(initialReleases)
    const [deployQuota, setDeployQuota] = useState<AIDeployQuota | null>(initialDeployQuota)
    const [ownershipSummary] = useState<AIOwnershipSummary | null>(initialOwnershipSummary)
    const [rollbackPendingId, setRollbackPendingId] = useState<string | null>(null)
    const [availableVmTargets, setAvailableVmTargets] = useState<AgentVmTarget[]>([])
    const [resumeNotice, setResumeNotice] = useState<{
        message: string
        conversationId: string | null
        workspaceId: string | null
    } | null>(null)
    const currentUserId = typeof document !== 'undefined' ? getCookie('id') || null : null
    const {
        shares,
        setShares,
        shareContents,
        setShareContents,
        shareTrees,
        setShareTrees,
        shareFileContents,
        hydrateShare,
        hydrateShareFile,
        resetShareWorkspaceCache,
    } = useShareWorkspaceState({ initialShares })

    useEffect(() => {
        conversationsRef.current = conversations
    }, [conversations])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const savedConversationId = window.localStorage.getItem('hanasand.ai.activeConversationId')
        const runtimeConversationId = initialRuntimeState?.activeConversationId || null
        const nextConversationId = initialConversationId || savedConversationId || runtimeConversationId

        if (!nextConversationId || !conversationsRef.current.some((conversation) => conversation.id === nextConversationId)) {
            return
        }

        setActiveConversationId(nextConversationId)

        if (initialConversationId) {
            return
        }

        const resumedConversation = conversationsRef.current.find((conversation) => conversation.id === nextConversationId) || null
        const source = savedConversationId === nextConversationId ? 'your last AI workspace selection' : 'the most recent runtime activity'
        const detail = initialRuntimeState?.lastFailure?.message || initialRuntimeState?.lastToolRun?.detail || null

        setResumeNotice({
            message: detail ? `Recovered ${source}: ${detail}` : `Recovered ${source}.`,
            conversationId: nextConversationId,
            workspaceId: resumedConversation?.workspaceId || null,
        })
    }, [initialConversationId, initialRuntimeState])

    useEffect(() => {
        if (typeof window === 'undefined' || !activeConversationId) {
            return
        }

        window.localStorage.setItem('hanasand.ai.activeConversationId', activeConversationId)
    }, [activeConversationId])

    useEffect(() => {
        refreshRuntimeRef.current = async () => {
            if (!isAuthenticated) {
                return
            }

            try {
                const response = await aiClientRequest('/ai/runtime')
                if (!response.ok) {
                    return
                }

                const payload = await response.json().catch(() => null) as { runtimeState?: AIRuntimeState } | null
                if (payload?.runtimeState) {
                    setRuntimeSnapshot(payload.runtimeState)
                }
            } catch {
                // Best-effort runtime refresh should not interrupt the current session.
            }
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated) {
            return
        }

        void refreshRuntimeRef.current()
        const interval = window.setInterval(() => {
            void refreshRuntimeRef.current()
        }, 10000)

        return () => {
            window.clearInterval(interval)
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated) {
            return
        }

        let cancelled = false
        const loadTargets = async () => {
            try {
                const response = await aiClientRequest('/vms/agent/targets')
                if (!response.ok) {
                    return
                }

                const payload = await response.json().catch(() => null) as { targets?: AgentVmTarget[] } | null
                const targets = Array.isArray(payload?.targets) ? payload.targets : []
                if (cancelled) {
                    return
                }

                setAvailableVmTargets(targets)
            } catch {
                // Best-effort VM discovery should not interrupt the workspace.
            }
        }

        void loadTargets()
        return () => {
            cancelled = true
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated || !activeConversationId) {
            return
        }

        let cancelled = false
        const refreshDeployments = async () => {
            try {
                const response = await aiClientRequest(`/ai/deployments?conversationId=${encodeURIComponent(activeConversationId)}`)
                const payload = await response.json().catch(() => null) as { deployments?: AIDeployment[], quota?: AIDeployQuota } | null
                if (!cancelled && Array.isArray(payload?.deployments)) {
                    setDeployments((prev) => [
                        ...payload.deployments!,
                        ...prev.filter((deployment) => deployment.conversationId !== activeConversationId),
                    ])
                    if (payload?.quota) {
                        setDeployQuota(payload.quota)
                    }
                }
            } catch {
                // Deploy history is a resume aid; failed polling should not interrupt the chat.
            }
        }

        void refreshDeployments()
        const interval = window.setInterval(refreshDeployments, 15000)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [activeConversationId, isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated || !activeConversationId) {
            return
        }

        let cancelled = false
        const refreshReleases = async () => {
            try {
                const response = await aiClientRequest(`/ai/releases?conversationId=${encodeURIComponent(activeConversationId)}`)
                const payload = await response.json().catch(() => null) as { releases?: AIRelease[] } | null
                if (!cancelled && Array.isArray(payload?.releases)) {
                    setReleases(payload.releases)
                }
            } catch {
                // Release history is informative; failed polling should not interrupt the workspace.
            }
        }

        void refreshReleases()
        const interval = window.setInterval(refreshReleases, 15000)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [activeConversationId, isAuthenticated])

    function createNewConversation() {
        return createNewConversationRef.current()
    }

    useEffect(() => {
        createNewConversationRef.current = async () => {
            const conversation = createConversation(clients[0]?.name || null)
            setConversations((prev) => [conversation, ...prev])
            setActiveConversationId(conversation.id)
            setStatusNotice(null)

            if (!isAuthenticated) {
                return
            }

            try {
                const response = await aiClientRequest('/ai/conversations', {
                    method: 'POST',
                    body: JSON.stringify(toConversationPayload(conversation)),
                })
                if (!response.ok) {
                    throw new Error('Unable to create a new conversation.')
                }
            } catch (error) {
                setStatusNotice(error instanceof Error ? error.message : 'Unable to create a new conversation.')
            }
        }
    }, [clients, isAuthenticated])

    useEffect(() => {
        if (bootstrappedRef.current || conversations.some((conversation) => !conversation.archivedAt)) {
            return
        }

        bootstrappedRef.current = true
        const timer = setTimeout(() => {
            void createNewConversationRef.current()
        }, 0)

        return () => clearTimeout(timer)
    }, [conversations])

    useEffect(() => {
        shouldReconnectRef.current = true

        const connect = () => {
            const ws = createWorkbenchSocket(`${config.url.api_client_wss}/client/ws/gpt`)
            socketRef.current = ws

            ws.onopen = () => {
                setIsConnected(true)
                setStatusNotice(null)
            }
            ws.onclose = () => {
                setIsConnected(false)
                socketRef.current = null
                if (!shouldReconnectRef.current) {
                    return
                }
                setStatusNotice('Connection lost. Reconnecting to the model pool...')
                reconnectTimerRef.current = setTimeout(connect, 2000)
            }
            ws.onerror = () => setIsConnected(false)
            ws.onmessage = (event) => {
                try {
                    handleSocketMessageRef.current(JSON.parse(event.data) as GptSocketMessage)
                } catch (error) {
                    console.error('Invalid AI socket payload', error)
                }
            }
        }

        connect()

        return () => {
            shouldReconnectRef.current = false
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current)
            }
            socketRef.current?.close()
        }
    }, [])

    const filteredConversations = useMemo(() => {
        const query = search.trim().toLowerCase()
        return conversations.filter((conversation) => {
            if (conversation.archivedAt) {
                return false
            }

            if (!query) {
                return true
            }

            return (
                conversation.title.toLowerCase().includes(query)
                || conversation.messages.some((message) => message.content.toLowerCase().includes(query))
                || (conversation.preferredModel || '').toLowerCase().includes(query)
            )
        })
    }, [conversations, search])

    const archivedConversations = useMemo(() => {
        const query = search.trim().toLowerCase()
        return conversations.filter((conversation) => {
            if (!conversation.archivedAt) {
                return false
            }

            if (!query) {
                return true
            }

            return (
                conversation.title.toLowerCase().includes(query)
                || conversation.messages.some((message) => message.content.toLowerCase().includes(query))
                || (conversation.preferredModel || '').toLowerCase().includes(query)
            )
        })
    }, [conversations, search])

    const resolvedActiveConversationId = useMemo(() => {
        if (activeConversationId && conversations.some((conversation) => conversation.id === activeConversationId)) {
            return activeConversationId
        }

        return conversations.find((conversation) => !conversation.archivedAt)?.id || conversations[0]?.id || null
    }, [activeConversationId, conversations])

    const {
        updateLocalConversation,
        replaceConversation,
        patchConversation,
        renameConversation,
        archiveConversation,
        deleteConversation,
        persistMessage,
    } = useConversationActions({
        conversations,
        isAuthenticated,
        resolvedActiveConversationId,
        setConversations,
        setActiveConversationId,
        setStatusNotice,
        createConversationFallback: createNewConversation,
    })

    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === resolvedActiveConversationId) || null,
        [resolvedActiveConversationId, conversations]
    )

    const selectedRepoFilePath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
        ? activeConversation.workspaceMeta.selectedFilePath
        : null
    const activeWorkspaceId = activeConversation?.workspaceId || null
    const activeShareTree = activeWorkspaceId ? shareTrees[activeWorkspaceId] || null : null
    const selectedShareFileContent = activeWorkspaceId && selectedRepoFilePath
        ? shareFileContents[`${activeWorkspaceId}:${selectedRepoFilePath}`] || null
        : null
    const selectedShareContent = activeWorkspaceId
        ? shareContents[activeWorkspaceId] || null
        : null

    const runtimeState = useMemo<AIRuntimeState>(() => {
        const localLastToolRun = deriveLastToolState(conversations)
        const localLastFailure = deriveLastFailure(conversations, statusNotice)
        const connectedClientCount = clients.length || runtimeSnapshot?.connectedClientCount || participants

        return {
            status: statusNotice
                ? 'error'
                : clients.some((client) => client.model.status === 'generating')
                    ? 'generating'
                    : clients.some((client) => client.model.status === 'preparing')
                        ? 'preparing'
                        : clients.some((client) => client.model.status === 'error')
                            ? 'error'
                            : connectedClientCount
                                ? 'idle'
                                : (runtimeSnapshot?.status || 'offline'),
            connectedClientCount,
            connectedModelNames: clients.length
                ? clients.map((client) => client.name)
                : (runtimeSnapshot?.connectedModelNames || []),
            activeConversationId: activeConversation?.id || runtimeSnapshot?.activeConversationId || null,
            activeWorkspace: {
                conversationId: activeConversation?.id || runtimeSnapshot?.activeWorkspace.conversationId || null,
                workspaceId: activeConversation?.workspaceId || runtimeSnapshot?.activeWorkspace.workspaceId || null,
                workspaceKind: activeConversation?.workspaceKind || runtimeSnapshot?.activeWorkspace.workspaceKind || null,
                shareIds: activeConversation?.shareIds || runtimeSnapshot?.activeWorkspace.shareIds || [],
                workspaceMeta: activeConversation?.workspaceMeta || runtimeSnapshot?.activeWorkspace.workspaceMeta || {},
            },
            lastToolRun: chooseNewestToolRun(runtimeSnapshot?.lastToolRun || null, localLastToolRun),
            lastFailure: chooseNewestFailure(runtimeSnapshot?.lastFailure || null, localLastFailure),
            lastUpdatedAt: [
                activeConversation?.updatedAt || null,
                localLastToolRun?.updatedAt || null,
                localLastFailure?.updatedAt || null,
                runtimeSnapshot?.lastUpdatedAt || null,
                clients.find((client) => client.model.lastUpdated)?.model.lastUpdated || null,
            ].find((value) => typeof value === 'string') || null,
        }
    }, [activeConversation, clients, conversations, participants, runtimeSnapshot, statusNotice])

    const runTerminalCommandOnShare = useCallback(async (shareId: string, command: string, timeoutMs = 20000) => {
        const share = shares.find((entry) => entry.id === shareId)
        if (!share?.alias) {
            return {
                ok: false,
                output: `Share ${shareId} is not available for terminal access yet.`,
            }
        }

        const session = randomId(6)
        const userId = getCookie('id') || 'default'

        return await new Promise<{ ok: boolean, output: string }>((resolve) => {
            const ws = createWorkbenchSocket(`${config.url.cdn_wss}/share/${share.alias}/shell/${userId}/${session}`)
            const chunks: string[] = []
            let settled = false
            let inactivityTimer: number | null = null
            const hardTimeout: number = window.setTimeout(
                () => finish(false, `Timed out after ${timeoutMs}ms.\n\n${chunks.join('')}`),
                timeoutMs
            )

            function clearTimers() {
                clearTimeout(hardTimeout)
                if (inactivityTimer) {
                    clearTimeout(inactivityTimer)
                }
            }

            function finish(ok: boolean, output: string) {
                if (settled) {
                    return
                }

                settled = true
                clearTimers()
                try {
                    ws.close()
                } catch {
                    // Socket may already be closed while the promise is settling.
                }
                resolve({ ok, output: output.trim() || '<no output>' })
            }

            function armInactivityTimer() {
                if (inactivityTimer) {
                    clearTimeout(inactivityTimer)
                }
                inactivityTimer = window.setTimeout(() => {
                    finish(true, chunks.join(''))
                }, 1200)
            }

            ws.onerror = () => finish(false, `Unable to connect to the terminal for share ${share.alias}.`)
            ws.onclose = () => {
                if (!settled) {
                    finish(true, chunks.join(''))
                }
            }
            ws.onopen = () => {
                ws.send(JSON.stringify({
                    type: 'terminalInput',
                    content: `${command}${command.endsWith('\n') ? '' : '\n'}`,
                }))
                armInactivityTimer()
            }
            ws.onmessage = async (event) => {
                try {
                    const raw = event.data instanceof Blob ? await event.data.text() : String(event.data)
                    const payload = JSON.parse(raw) as { type?: string, content?: string }
                    if (payload.type === 'update' && typeof payload.content === 'string') {
                        chunks.push(payload.content)
                        armInactivityTimer()
                    }
                } catch {
                    // Ignore malformed terminal frames and keep collecting output.
                }
            }
        })
    }, [shares])

    useEffect(() => {
        hydrateShareRef.current = hydrateShare
    }, [hydrateShare])

    useEffect(() => {
        hydrateShareFileRef.current = hydrateShareFile
    }, [hydrateShareFile])

    useEffect(() => {
        if (!activeConversation?.shareIds?.length) {
            return
        }

        const timer = setTimeout(() => {
            for (const shareId of activeConversation.shareIds) {
                if (!shareContents[shareId]) {
                    void hydrateShareRef.current(shareId)
                }
            }
        }, 0)

        return () => clearTimeout(timer)
    }, [activeConversation, shareContents])

    useEffect(() => {
        const selectedPath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
            ? activeConversation.workspaceMeta.selectedFilePath
            : null
        const workspaceId = activeConversation?.workspaceId
        if (!workspaceId || !selectedPath) {
            return
        }

        const key = `${workspaceId}:${selectedPath}`
        const timer = setTimeout(() => {
            if (!shareFileContents[key]) {
                void hydrateShareFileRef.current(workspaceId, selectedPath)
            }
        }, 0)

        return () => clearTimeout(timer)
    }, [activeConversation, shareFileContents])

    async function persistRepository(repo: AIImportedRepo) {
        if (!isAuthenticated) {
            return
        }

        const response = await aiClientRequest('/ai/repositories', {
            method: 'POST',
            body: JSON.stringify(repo),
        })
        if (!response.ok) {
            throw new Error('Unable to save repository sync state.')
        }
    }

    function upsertRepository(repo: AIImportedRepo) {
        setImportedRepos((prev) => [repo, ...prev.filter((entry) => entry.id !== repo.id)])
        setShares((prev) => [{
            id: repo.id,
            path: repo.fullName,
            alias: repo.name,
            content: '',
            wordCount: 0,
            estimatedMinutes: 0,
            timestamp: repo.importedAt,
            git: repo.sourceUrl,
            locked: false,
            owner: getCookie('id') || '',
            parent: '',
        }, ...prev.filter((entry) => entry.id !== repo.id)])
    }

    const attachShare = useCallback(async (shareId: string) => {
        if (!activeConversation) {
            return
        }

        const nextShareIds = Array.from(new Set([shareId, ...(activeConversation.shareIds || [])]))
        const share = await hydrateShareRef.current(shareId)
        const token = getCookie('access_token') || undefined
        const userId = getCookie('id') || undefined
        const tree = shareTrees[shareId] || await getTree({ id: shareId, token, userId })
        if (tree) {
            setShareTrees((prev) => ({ ...prev, [shareId]: tree }))
        }
        const treePaths = listTreePaths(tree || null)
        const selectedFilePath = treePaths[0] || ''
        await patchConversation(activeConversation.id, {
            workspaceId: shareId,
            workspaceKind: 'share',
            shareIds: nextShareIds,
            workspaceMeta: withWorkspaceActivity({
                ...activeConversation.workspaceMeta,
                selectedFilePath,
            }, {
                action: 'Attached share workspace',
                path: selectedFilePath || undefined,
                source: 'share',
            }),
        })
        if (selectedFilePath) {
            await hydrateShareFileRef.current(shareId, selectedFilePath)
        }
        if (share) {
            setShareContents((prev) => ({ ...prev, [shareId]: share.content }))
        }
    }, [activeConversation, patchConversation, shareTrees])

    const attachRepo = useCallback(async (repoId: string, importedRepo?: AIImportedRepo) => {
        const repo = importedRepo || importedRepos.find((item) => item.id === repoId)
        if (!repo || !activeConversation) {
            return
        }

        const shareId = repo.id
        const nextShareIds = Array.from(new Set([shareId, ...(activeConversation.shareIds || [])]))
        await patchConversation(activeConversation.id, {
            workspaceId: shareId,
            workspaceKind: 'repo',
            shareIds: nextShareIds,
            workspaceMeta: withWorkspaceActivity({
                ...activeConversation.workspaceMeta,
                repositoryId: repo.id,
                repositoryName: repo.fullName,
                repositoryBranch: repo.branch,
                repositorySourceUrl: repo.sourceUrl,
                selectedFilePath: repo.files[0]?.path || '',
            }, {
                action: 'Attached repository mirror',
                path: repo.files[0]?.path || undefined,
                source: 'repository-sync',
            }),
        })
        await hydrateShareRef.current(shareId)
        if (repo.files[0]?.path) {
            await hydrateShareFileRef.current(shareId, repo.files[0].path)
        }
    }, [activeConversation, importedRepos, patchConversation])

    async function importRepo() {
        if (!importInput.trim()) {
            return
        }

        setImportPending(true)
        setImportError(null)
        let pendingRepo: AIImportedRepo | null = null
        try {
            setStatusNotice(null)
            const imported = await importGitHubRepository(importInput, undefined, githubToken)
            const existing = importedRepos.find((repo) =>
                repo.fullName === imported.fullName
                && repo.branch === imported.branch
                && repo.sourcePath === imported.sourcePath
            )
            const repo = existing ? { ...imported, id: existing.id } : imported
            const token = getCookie('access_token')
            const userId = getCookie('id')
            pendingRepo = withRepositorySync(repo, {
                status: 'syncing',
                source: existing ? 'refresh' : 'import',
                message: existing ? 'Refreshing repository and syncing workspace...' : 'Importing repository and creating workspace...',
            })
            upsertRepository(pendingRepo)
            await persistRepository(pendingRepo)
            if (githubToken.trim()) {
                const credential = await attachGitHubCredential(pendingRepo.id, githubToken.trim())
                pendingRepo = {
                    ...pendingRepo,
                    authMode: 'github_token',
                    authHint: 'Private GitHub access is stored server-side for this repository. You can revoke it from the workspace.',
                    credential,
                }
                upsertRepository(pendingRepo)
                await persistRepository(pendingRepo)
            }

            if (existing) {
                await syncRepositoryToShare({ repo: pendingRepo, token, userId })
            } else {
                await importRepositoryToShare({ repo: pendingRepo, token, userId })
            }
            const pendingRepoId = pendingRepo.id
            resetShareWorkspaceCache(pendingRepoId)
            await hydrateShareRef.current(pendingRepoId)
            const readyRepo = withRepositorySync(pendingRepo, {
                status: 'ready',
                source: existing ? 'refresh' : 'import',
                message: existing ? 'Repository refresh complete.' : 'Repository imported into the editor workspace.',
            })
            upsertRepository(readyRepo)
            setImportInput('')
            setGitHubToken('')
            await persistRepository(readyRepo)
            setStatusNotice(existing ? 'Repository refreshed and synced into the editor workspace.' : 'Repository imported and ready in the editor workspace.')
            await attachRepo(readyRepo.id, readyRepo)
        } catch (error) {
            if (pendingRepo) {
                const failedRepo = withRepositorySync(pendingRepo, {
                    status: 'error',
                    source: 'import',
                    message: error instanceof Error ? error.message : 'Failed to import repository.',
                })
                upsertRepository(failedRepo)
                try {
                    await persistRepository(failedRepo)
                } catch {
                    // Preserve the sync error locally even if persistence also fails.
                }
            }
            setImportError(error instanceof Error ? error.message : 'Failed to import repository.')
        } finally {
            setImportPending(false)
        }
    }

    async function refreshRepo(repoId: string) {
        const existing = importedRepos.find((repo) => repo.id === repoId)
        if (!existing) {
            return
        }

        setSyncingRepoId(repoId)
        setImportError(null)
        try {
            setStatusNotice(null)
            const pendingRepo = withRepositorySync(existing, {
                status: 'syncing',
                source: 'refresh',
                message: 'Refreshing repository from GitHub...',
            })
            upsertRepository(pendingRepo)
            await persistRepository(pendingRepo)
            const refreshed = await importGitHubRepository(existing.sourceUrl, existing.id, githubToken)
            const token = getCookie('access_token')
            const userId = getCookie('id')
            await syncRepositoryToShare({ repo: refreshed, token, userId })
            resetShareWorkspaceCache(repoId)
            await hydrateShareRef.current(repoId)
            const readyRepo = withRepositorySync(refreshed, {
                status: 'ready',
                source: 'refresh',
                message: 'Repository sync complete.',
            })
            upsertRepository(readyRepo)
            setGitHubToken('')
            await persistRepository(readyRepo)
            setStatusNotice('Repository refresh complete.')
            if (activeConversation?.workspaceMeta?.repositoryId === repoId) {
                await attachRepo(repoId, readyRepo)
            }
        } catch (error) {
            const failedRepo = withRepositorySync(existing, {
                status: 'error',
                source: 'refresh',
                message: error instanceof Error ? error.message : 'Failed to refresh repository.',
            })
            upsertRepository(failedRepo)
            try {
                await persistRepository(failedRepo)
            } catch {
                // Preserve the sync error locally even if persistence also fails.
            }
            setImportError(error instanceof Error ? error.message : 'Failed to refresh repository.')
        } finally {
            setSyncingRepoId(null)
        }
    }

    async function revokeRepoCredential(repoId: string) {
        const existing = importedRepos.find((repo) => repo.id === repoId)
        if (!existing) {
            return
        }

        await removeGitHubCredential(repoId)
        const updatedRepo = {
            ...existing,
            authMode: 'public' as const,
            authHint: null,
            credential: {
                provider: 'github_pat' as const,
                hasCredential: false,
                tokenHint: null,
                attachedAt: null,
                lastUsedAt: null,
                lastValidatedAt: null,
            },
        }
        upsertRepository(updatedRepo)
        await persistRepository(updatedRepo)
        setStatusNotice('GitHub credential removed for this repository.')
    }

    const selectRepoFile = useCallback(async (path: string) => {
        if (!activeConversation || typeof activeConversation.workspaceMeta?.repositoryId !== 'string' || !activeConversation.workspaceId) {
            return
        }

        await hydrateShareFileRef.current(activeConversation.workspaceId, path)
        await patchConversation(activeConversation.id, {
            workspaceMeta: withWorkspaceActivity({
                ...activeConversation.workspaceMeta,
                selectedFilePath: path,
            }, {
                action: 'Focused repository file',
                path,
            }),
        })
    }, [activeConversation, patchConversation])

    const selectShareFile = useCallback(async (path: string) => {
        if (!activeConversation || !activeConversation.workspaceId) {
            return
        }

        await hydrateShareFileRef.current(activeConversation.workspaceId, path)
        await patchConversation(activeConversation.id, {
            workspaceMeta: withWorkspaceActivity({
                ...activeConversation.workspaceMeta,
                selectedFilePath: path,
            }, {
                action: 'Focused share file',
                path,
            }),
        })
    }, [activeConversation, patchConversation])

    const scaffoldStarter = useCallback(async (template: 'nextjs_docker', projectName?: string | null, targetShareId?: string | null) => {
        if (!activeConversation) {
            return
        }

        if (template !== 'nextjs_docker') {
            setStatusNotice(`Unsupported starter template: ${template}`)
            return
        }

        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            setStatusNotice('Sign in to scaffold a workspace.')
            return
        }

        try {
            setStatusNotice('Scaffolding a Next.js + Docker workspace...')
            const scaffold = await scaffoldNextjsDockerWorkspace({
                projectName,
                shareId: targetShareId || (activeConversation.workspaceKind === 'share' ? activeConversation.workspaceId : null),
                token,
                userId,
            })

            setShares((prev) => {
                const existing = prev.find((share) => share.id === scaffold.rootId)
                const nextShare: Share = existing ? {
                    ...existing,
                    path: scaffold.rootPath,
                    alias: scaffold.rootName,
                    content: existing.content || '',
                } : {
                    id: scaffold.rootId,
                    path: scaffold.rootPath,
                    alias: scaffold.rootName,
                    content: '',
                    wordCount: 0,
                    estimatedMinutes: 0,
                    timestamp: new Date().toISOString(),
                    git: null,
                    locked: false,
                    owner: userId,
                    parent: '',
                }

                return [nextShare, ...prev.filter((share) => share.id !== scaffold.rootId)]
            })
            resetShareWorkspaceCache(scaffold.rootId)
            await attachShare(scaffold.rootId)
            await selectShareFile(scaffold.selectedFilePath)
            await patchConversation(activeConversation.id, {
                workspaceMeta: withWorkspaceActivity({
                    ...activeConversation.workspaceMeta,
                    selectedFilePath: scaffold.selectedFilePath,
                }, {
                    action: 'Scaffolded Next.js + Docker starter',
                    path: scaffold.selectedFilePath,
                    source: 'scaffold',
                }),
            })
            setStatusNotice(`Next.js + Docker workspace ready: ${scaffold.rootName}. Created ${scaffold.fileCount} files.`)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to scaffold the Next.js workspace.'
            setStatusNotice(message)
            throw new Error(message, { cause: error })
        }
    }, [activeConversation, attachShare, selectShareFile])

    const startDeployment = useCallback(async ({
        vmName,
        port,
        healthPath,
        accessPolicy,
    }: {
        vmName: string
        port: string
        healthPath: string
        accessPolicy: AIDeploymentAccessPolicy
    }) => {
        if (!activeConversation) {
            setStatusNotice('Open a conversation before starting a deploy.')
            return
        }

        if (!isAuthenticated) {
            setStatusNotice('Sign in to deploy a workspace.')
            return
        }

        const targetVmName = vmName.trim()
        if (!targetVmName) {
            setStatusNotice('Choose a VM target before starting a deploy.')
            return
        }

        setDeployPending(true)
        setStatusNotice('Starting remote deploy orchestration...')
        try {
            const response = await aiClientRequest('/ai/deployments', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId: activeConversation.id,
                    vmName: targetVmName,
                    port,
                    healthPath,
                    accessPolicy,
                }),
            })
            const payload = await response.json().catch(() => null) as { deployment?: AIDeployment, quota?: AIDeployQuota, error?: string } | null
            if (!response.ok && !payload?.deployment) {
                throw new Error(payload?.error || 'Unable to start deploy orchestration.')
            }

            if (payload?.deployment) {
                setDeployments((prev) => [payload.deployment!, ...prev.filter((deployment) => deployment.id !== payload.deployment!.id)])
                if (payload.quota) {
                    setDeployQuota(payload.quota)
                }
                setStatusNotice(payload.deployment.status === 'running'
                    ? 'Deploy healthcheck passed. Preview is reachable from the VM target.'
                    : payload.deployment.failureReason || 'Deploy requires a manual follow-up step.')
            }
        } catch (error) {
            setStatusNotice(error instanceof Error ? error.message : 'Unable to start deploy orchestration.')
        } finally {
            setDeployPending(false)
        }
    }, [activeConversation, isAuthenticated])

    const activeDeployments = useMemo(() => {
        if (!activeConversation) {
            return []
        }

        return deployments.filter((deployment) => deployment.conversationId === activeConversation.id)
    }, [activeConversation, deployments])

    const activeReleases = useMemo(() => {
        if (!activeConversation) {
            return []
        }

        return releases.filter((release) => release.conversationId === activeConversation.id)
    }, [activeConversation, releases])

    const inviteCollaborator = useCallback(async (userId: string, role: 'reviewer' | 'editor') => {
        if (!activeConversation) {
            setCollaborationError('Open a conversation before inviting collaborators.')
            return
        }

        if (!isAuthenticated) {
            setCollaborationError('Sign in to invite collaborators.')
            return
        }

        const trimmedUserId = userId.trim()
        if (!trimmedUserId) {
            setCollaborationError('Enter a user id before inviting a collaborator.')
            return
        }

        if (!activeConversation.collaboration?.canInvite) {
            setCollaborationError('Only the conversation owner can invite collaborators.')
            return
        }

        setCollaboratorPending(true)
        setCollaborationError(null)
        try {
            const response = await aiClientRequest(`/ai/conversations/${activeConversation.id}/collaborators`, {
                method: 'POST',
                body: JSON.stringify({ userId: trimmedUserId, role }),
            })
            const payload = await response.json().catch(() => null) as { conversation?: AIConversation, error?: string } | null
            if (!response.ok || !payload?.conversation) {
                throw new Error(payload?.error || 'Unable to invite collaborator.')
            }

            replaceConversation(payload.conversation)
            setStatusNotice(`Shared this AI session with ${trimmedUserId} as ${role}.`)
        } catch (error) {
            setCollaborationError(error instanceof Error ? error.message : 'Unable to invite collaborator.')
        } finally {
            setCollaboratorPending(false)
        }
    }, [activeConversation, isAuthenticated])

    const removeCollaborator = useCallback(async (targetUserId: string) => {
        if (!activeConversation) {
            setCollaborationError('Open a conversation before updating collaborators.')
            return
        }

        if (!isAuthenticated) {
            setCollaborationError('Sign in to update collaborators.')
            return
        }

        const trimmedUserId = targetUserId.trim()
        if (!trimmedUserId) {
            setCollaborationError('Missing collaborator id.')
            return
        }

        setCollaboratorPending(true)
        setCollaborationError(null)
        try {
            const response = await aiClientRequest(`/ai/conversations/${activeConversation.id}/collaborators/${encodeURIComponent(trimmedUserId)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null) as {
                ok?: boolean
                conversation?: AIConversation | null
                error?: string
            } | null
            if (!response.ok || !payload?.ok) {
                throw new Error(payload?.error || 'Unable to remove collaborator.')
            }

            if (payload.conversation) {
                replaceConversation(payload.conversation)
            } else if (trimmedUserId === currentUserId && activeConversation.collaboration.role !== 'owner') {
                setConversations((prev) => prev.filter((conversation) => conversation.id !== activeConversation.id))
                if (resolvedActiveConversationId === activeConversation.id) {
                    const nextConversation = conversationsRef.current.find((conversation) => conversation.id !== activeConversation.id && !conversation.archivedAt)
                        || conversationsRef.current.find((conversation) => conversation.id !== activeConversation.id)
                        || null
                    setActiveConversationId(nextConversation?.id || null)
                }
            } else {
                updateLocalConversation(activeConversation.id, {
                    collaboration: {
                        ...activeConversation.collaboration,
                        collaborators: activeConversation.collaboration.collaborators.filter((collaborator) => collaborator.userId !== trimmedUserId),
                        seatCount: Math.max(activeConversation.collaboration.seatCount - 1, 0),
                        remainingSeats: Math.min(activeConversation.collaboration.remainingSeats + 1, activeConversation.collaboration.seatLimit),
                    },
                })
            }

            setStatusNotice(trimmedUserId === currentUserId && activeConversation.collaboration.role !== 'owner'
                ? 'You left the shared AI session.'
                : `Removed ${trimmedUserId} from this AI session.`)
        } catch (error) {
            setCollaborationError(error instanceof Error ? error.message : 'Unable to remove collaborator.')
        } finally {
            setCollaboratorPending(false)
        }
    }, [activeConversation, currentUserId, isAuthenticated, resolvedActiveConversationId])

    const rollbackRelease = useCallback(async (releaseId: string) => {
        if (!isAuthenticated) {
            setStatusNotice('Sign in to manage release history.')
            return
        }

        setRollbackPendingId(releaseId)
        try {
            const response = await aiClientRequest(`/ai/releases/${encodeURIComponent(releaseId)}/rollback`, {
                method: 'POST',
            })
            const payload = await response.json().catch(() => null) as { release?: AIRelease, error?: string } | null
            if (!response.ok || !payload?.release) {
                throw new Error(payload?.error || 'Unable to mark rollback target.')
            }

            setReleases((prev) => prev.map((release) => {
                if (release.conversationId !== payload.release!.conversationId) {
                    return release
                }
                if (release.id === payload.release!.id) {
                    return payload.release!
                }
                if (release.status === 'current') {
                    return {
                        ...release,
                        status: 'rolled_back',
                        updatedAt: payload.release!.updatedAt,
                    }
                }
                return release
            }))
            setStatusNotice('Marked a previous release as the rollback target. Final restore is still a manual VM step.')
        } catch (error) {
            setStatusNotice(error instanceof Error ? error.message : 'Unable to mark rollback target.')
        } finally {
            setRollbackPendingId(null)
        }
    }, [isAuthenticated])

    async function setPreferredModel(preferredModel: string | null) {
        if (!activeConversation) {
            return
        }

        await patchConversation(activeConversation.id, {
            preferredModel,
        })
    }

    async function setModelStrategy(modelStrategy: 'auto' | 'pinned') {
        if (!activeConversation) {
            return
        }

        await patchConversation(activeConversation.id, { modelStrategy })
    }

    async function sendPrompt() {
        const prompt = composer.trim()
        if (!prompt || !activeConversation) {
            return
        }

        if (activeConversation.messages.at(-1)?.pending) {
            setStatusNotice('Wait for the current response to finish before sending another prompt.')
            return
        }

        const socket = socketRef.current
        const resolvedModel = resolveModelName(activeConversation, clients)
        if (!socket || socket.readyState !== WebSocket.OPEN || !resolvedModel) {
            setConversations((prev) => prev.map((conversation) => conversation.id === activeConversation.id
                ? appendError(conversation, 'No live model client is connected.')
                : conversation))
            return
        }

        const userMessage: AIConversationMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: prompt,
            createdAt: new Date().toISOString(),
            modelName: resolvedModel,
        }
        const assistantMessage: AIConversationMessage = {
            id: `${activeConversation.id}-assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            pending: true,
            createdAt: new Date().toISOString(),
            modelName: resolvedModel,
        }

        const workspaceContext = await buildWorkspaceContext(
            activeConversation,
            importedRepos,
            shareContents,
            shareTrees,
            shareFileContents,
        )
        const messages = [
            {
                role: 'system' as const,
                content: buildSystemPrompt({ conversation: activeConversation, workspaceContext }),
            },
            ...activeConversation.messages
                .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'tool')
                .map((message) => ({
                    role: message.role === 'tool' ? 'assistant' as const : message.role,
                    content: message.content,
                })),
            {
                role: 'user' as const,
                content: prompt,
            },
        ]

        setConversations((prev) => prev.map((conversation) => conversation.id === activeConversation.id
            ? {
                ...conversation,
                activeModel: resolvedModel,
                title: conversation.messages.length ? conversation.title : prompt.slice(0, 72),
                updatedAt: new Date().toISOString(),
                messages: [...conversation.messages, userMessage, assistantMessage],
            }
            : conversation))
        setComposer('')

        await patchConversation(activeConversation.id, {
            activeModel: resolvedModel,
            title: activeConversation.messages.length ? activeConversation.title : prompt.slice(0, 72),
        })
        await persistMessage(activeConversation.id, userMessage)
        await persistMessage(activeConversation.id, assistantMessage)

        socket.send(JSON.stringify({
            type: 'prompt_request',
            conversationId: activeConversation.id,
            clientName: resolvedModel,
            messages,
            maxTokens: 1024,
            temperature: 0.35,
        }))
    }

    const persistAssistantMessageFromEvent = useCallback(async (message: GptSocketMessage) => {
        if (message.type !== 'prompt_complete' && message.type !== 'prompt_error') {
            return
        }

        if (!message.conversationId) {
            return
        }

        const conversation = conversationsRef.current.find((entry) => entry.id === message.conversationId)
        if (!conversation) {
            return
        }

        const lastMessage = conversation.messages[conversation.messages.length - 1]
        if (!lastMessage || lastMessage.role !== 'assistant') {
            return
        }

        const rawContent = message.type === 'prompt_complete'
            ? (message.content || lastMessage.content)
            : (message.error || lastMessage.content || 'The model failed to answer this prompt.')
        const visibleContent = message.type === 'prompt_complete'
            ? (stripToolTags(rawContent).trim() || rawContent)
            : rawContent

        const assistantMessage: AIConversationMessage = {
            ...lastMessage,
            content: visibleContent,
            pending: false,
            error: message.type === 'prompt_error',
            modelName: message.clientName || lastMessage.modelName || conversation.activeModel,
            metadata: {
                ...(lastMessage.metadata || {}),
                artifacts: message.artifacts || (lastMessage.metadata?.artifacts as AIArtifact[] | undefined) || [],
            },
        }

        setConversations((prev) => {
            const nextConversations = prev.map((entry) => {
                if (entry.id !== message.conversationId) {
                    return entry
                }

                const messages = [...entry.messages]
                const index = messages.findIndex((item) => item.id === assistantMessage.id)
                if (index >= 0) {
                    messages[index] = assistantMessage
                }

                return {
                    ...entry,
                    updatedAt: new Date().toISOString(),
                    messages,
                }
            })

            conversationsRef.current = nextConversations
            return nextConversations
        })

        await persistMessage(message.conversationId, assistantMessage)
        if (message.type === 'prompt_complete') {
            await executeAssistantToolsRef.current(conversation, {
                ...assistantMessage,
                content: rawContent,
            })
        }
    }, [persistMessage])

    useEffect(() => {
        handleSocketMessageRef.current = (message: GptSocketMessage) => {
            if (message.type === 'join') {
                setParticipants(message.participants || 0)
                return
            }

            if (message.type === 'snapshot') {
                const normalized = (message.clients || []).map(normalizeClient)
                setParticipants(message.participants || normalized.length)
                setClients(normalized)
                return
            }

            if (message.type === 'update' && message.client) {
                const normalizedClient = normalizeClient(message.client)
                setParticipants(message.participants || 0)
                setClients((prev) => {
                    const existing = prev.find((client) => client.name === normalizedClient.name)
                    return existing
                        ? prev.map((client) => client.name === normalizedClient.name ? normalizedClient : client)
                        : [...prev, normalizedClient]
                })
                setConversations((prev) => prev.map((conversation) => (
                    conversation.activeModel === normalizedClient.name || conversation.preferredModel === normalizedClient.name
                        ? { ...conversation, metrics: normalizedClient.model }
                        : conversation
                )))
                return
            }

            if (!message.conversationId) {
                return
            }

            setConversations((prev) => {
                const nextConversations = prev.map((conversation) => {
                    if (conversation.id !== message.conversationId) {
                        return conversation
                    }

                    if (message.type === 'prompt_started') {
                        return {
                            ...conversation,
                            activeModel: message.clientName || conversation.activeModel,
                            updatedAt: new Date().toISOString(),
                            metrics: message.metrics || conversation.metrics,
                        }
                    }

                    if (message.type === 'prompt_tool' && message.toolId && message.toolLabel) {
                        const messages = [...conversation.messages]
                        const existingIndex = messages.findIndex((entry) => entry.role === 'tool' && entry.metadata?.toolId === message.toolId)
                        const toolMessage: AIConversationMessage = {
                            id: existingIndex >= 0 ? messages[existingIndex].id : `tool-${message.toolId}`,
                            role: 'tool',
                            content: message.toolDetail ? `${message.toolLabel}\n\n${message.toolDetail}` : message.toolLabel,
                            createdAt: existingIndex >= 0 ? messages[existingIndex].createdAt : new Date().toISOString(),
                            metadata: {
                                toolId: message.toolId,
                                toolState: message.toolState || 'running',
                                agentTool: true,
                            },
                        }
                        if (existingIndex >= 0) {
                            messages[existingIndex] = {
                                ...messages[existingIndex],
                                ...toolMessage,
                            }
                        } else {
                            messages.push(toolMessage)
                        }

                        return {
                            ...conversation,
                            updatedAt: new Date().toISOString(),
                            messages,
                            metrics: message.metrics || conversation.metrics,
                        }
                    }

                    if (message.type === 'prompt_delta' || message.type === 'prompt_complete') {
                        const messages = [...conversation.messages]
                        const lastMessage = messages[messages.length - 1]
                        if (lastMessage?.role === 'assistant') {
                            messages[messages.length - 1] = {
                                ...lastMessage,
                                modelName: message.clientName || lastMessage.modelName || conversation.activeModel,
                                content: message.content || `${lastMessage.content}${message.delta || ''}`,
                                pending: message.type === 'prompt_delta',
                                metadata: {
                                    ...(lastMessage.metadata || {}),
                                    artifacts: message.artifacts || (lastMessage.metadata?.artifacts as AIArtifact[] | undefined) || [],
                                },
                            }
                        }

                        return {
                            ...conversation,
                            updatedAt: new Date().toISOString(),
                            activeModel: message.clientName || conversation.activeModel,
                            metrics: message.metrics || conversation.metrics,
                            messages,
                        }
                    }

                    if (message.type === 'prompt_error') {
                        return appendError(conversation, message.error || 'The model failed to answer this prompt.', message.metrics, message.clientName || conversation.activeModel)
                    }

                    return conversation
                })

                conversationsRef.current = nextConversations
                return nextConversations
            })

            if (message.type === 'prompt_complete' || message.type === 'prompt_error') {
                setTimeout(() => {
                    void persistAssistantMessageFromEvent(message)
                }, 0)
            }
        }
    }, [persistAssistantMessageFromEvent])

    useEffect(() => {
        executeAssistantToolsRef.current = async (conversation: AIConversation, message: AIConversationMessage) => {
            const toolCalls = parseToolCalls(message.content)
            if (!toolCalls.length) {
                return
            }

            for (const toolCall of toolCalls) {
                const latestConversation = conversationsRef.current.find((entry) => entry.id === conversation.id) || conversation
                const result = await runToolCallRef.current(latestConversation, toolCall)
                const toolMessage: AIConversationMessage = {
                    id: crypto.randomUUID(),
                    role: 'tool',
                    content: result.message,
                    error: !result.ok,
                    createdAt: new Date().toISOString(),
                    metadata: {
                        tool: toolCall.action,
                        toolState: result.ok ? 'completed' : 'error',
                    },
                }

                setConversations((prev) => prev.map((entry) => entry.id === conversation.id
                    ? {
                        ...entry,
                        updatedAt: new Date().toISOString(),
                        messages: [...entry.messages, toolMessage],
                    }
                    : entry))
                await persistMessage(conversation.id, toolMessage)
            }
        }
    }, [persistMessage])

    useEffect(() => {
        runToolCallRef.current = async (conversation: AIConversation, toolCall: AiToolCall) => {
            if (toolCall.action === 'read_share') {
                const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
                if (!shareId) {
                    return { ok: false, message: 'Tool failed: no share is attached to this conversation.' }
                }

                const share = await hydrateShareRef.current(shareId)
                if (!share) {
                    return { ok: false, message: `Tool failed: unable to read share ${shareId}.` }
                }

                return {
                    ok: true,
                    message: `Read share ${shareId}.\n\n${share.content.slice(0, 12000)}`,
                }
            }

            if (toolCall.action === 'update_share') {
                const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
                if (!shareId || !toolCall.content) {
                    return { ok: false, message: 'Tool failed: update_share requires a target share and content.' }
                }

                const updated = await updateShare(shareId, {
                    content: toolCall.content,
                    path: toolCall.path,
                })
                if (!updated) {
                    return { ok: false, message: `Tool failed: unable to update share ${shareId}.` }
                }

                setShareContents((prev) => ({ ...prev, [shareId]: updated.content }))
                return {
                    ok: true,
                    message: `Updated share ${shareId}${toolCall.path ? ` at ${toolCall.path}` : ''}.`,
                }
            }

            if (toolCall.action === 'http_request' && toolCall.url) {
                const response = await aiClientRequest('/tools/http/request', {
                    method: 'POST',
                    body: JSON.stringify({
                        url: toolCall.url,
                        method: toolCall.method || 'GET',
                        headers: toolCall.headers || {},
                        body: toolCall.body,
                    }),
                })

                const body = await response.text()
                return {
                    ok: response.ok,
                    message: `HTTP ${toolCall.method || 'GET'} ${toolCall.url}\nStatus: ${response.status}\n\n${body.slice(0, 12000)}`,
                }
            }

            if (toolCall.action === 'scaffold_nextjs_docker') {
                const projectName = toolCall.projectName || conversation.title || 'hanasand-next-docker'
                await scaffoldStarter('nextjs_docker', projectName, toolCall.shareId || conversation.workspaceId || null)
                const workspaceName = projectName.trim() || 'hanasand-next-docker'
                return {
                    ok: true,
                    message: `Scaffolded a Next.js + Docker workspace for ${workspaceName}. The workspace is attached and ready for follow-up edits.`,
                }
            }

            if (toolCall.action === 'create_vm') {
                const vmName = slugify(toolCall.vmName || toolCall.projectName || conversation.title || 'hanasand-project')
                const result = await postVM({ name: vmName })
                return {
                    ok: result.status < 400 || result.status === 409,
                    message: result.message,
                }
            }

            if (toolCall.action === 'create_project') {
                const projectName = toolCall.projectName || conversation.title || 'hanasand-project'
                const vmName = slugify(toolCall.vmName || projectName)
                const result = await postVM({ name: vmName })
                if (result.status >= 400 && result.status !== 409) {
                    return { ok: false, message: result.message }
                }

                await scaffoldStarter('nextjs_docker', projectName, toolCall.shareId || conversation.workspaceId || null)
                return {
                    ok: true,
                    message: `Created project workspace for ${projectName} and prepared VM ${vmName}. ${result.message}`,
                }
            }

            if (toolCall.action === 'run_terminal_command') {
                const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
                if (!shareId || !toolCall.command) {
                    return { ok: false, message: 'Tool failed: run_terminal_command requires a target share and command.' }
                }

                const terminalResult = await runTerminalCommandOnShare(shareId, toolCall.command, toolCall.timeoutMs)
                return {
                    ok: terminalResult.ok,
                    message: [
                        `Ran terminal command on share ${shareId}.`,
                        `Command: ${toolCall.command}`,
                        'Output:',
                        terminalResult.output,
                    ].join('\n\n'),
                }
            }

            return { ok: false, message: `Tool failed: unsupported action ${toolCall.action}.` }
        }
    }, [activeConversation, runTerminalCommandOnShare, scaffoldStarter])

    return {
        activeConversation,
        activeConversationId: resolvedActiveConversationId,
        activeDeployments,
        archivedConversations,
        archiveConversation,
        attachRepo,
        attachShare,
        clients,
        composer,
        collaborationError,
        collaboratorPending,
        createNewConversation,
        deleteConversation,
        deployments: activeDeployments,
        deployQuota,
        ownershipSummary,
        deployPending,
        releases: activeReleases,
        rollbackPendingId,
        filteredConversations,
        importError,
        importInput,
        githubToken,
        importPending,
        importedRepos,
        initialShares: shares,
        isConnected,
        currentUserId,
        participants,
        allDeployments: deployments,
        availableVmTargets,
        refreshRepo,
        revokeRepoCredential,
        activeShareTree,
        selectedRepoFilePath,
        selectedShareContent,
        selectedShareFileContent,
        scaffoldStarter,
        startDeployment,
        selectConversation: setActiveConversationId,
        selectRepoFile,
        selectShareFile,
        sendPrompt,
        setComposer,
        setImportInput,
        setGitHubToken,
        setModelStrategy,
        setPreferredModel,
        setSearch,
        syncingRepoId,
        importRepo,
        isAuthenticated,
        renameConversation,
        inviteCollaborator,
        rollbackRelease,
        removeCollaborator,
        resumeNotice,
        search,
        statusNotice,
        runtimeState,
        setResumeNotice,
    }
}
