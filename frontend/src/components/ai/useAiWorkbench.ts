'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { getShare } from '@/utils/share/get'
import { getTree } from '@/utils/share/getTree'
import { updateShare } from '@/utils/share/put'
import postVM from '@/utils/vms/fetch/postVM'
import defaultModelMetrics from '@/components/gpt/defaultModelMetrics'
import normalizeClient from '@/components/gpt/normalizeClient'
import { aiClientRequest } from '@/utils/ai/client'
import { importRepositoryToShare } from '@/utils/ai/importRepositoryToShare'
import { scaffoldNextjsDockerWorkspace } from '@/utils/ai/scaffoldWorkspace'
import { syncRepositoryToShare } from '@/utils/ai/syncRepositoryToShare'
import { importGitHubRepository } from './github'
import { findTreeFileId, listTreePaths } from './shareTree'

type UseAiWorkbenchProps = {
    initialConversations: AIConversation[]
    initialRepositories: AIImportedRepo[]
    initialShares: Share[]
    isAuthenticated: boolean
    initialConversationId?: string | null
}

type AiToolCall = {
    action: 'read_share' | 'update_share' | 'http_request' | 'scaffold_nextjs_docker' | 'create_vm' | 'create_project' | 'run_terminal_command'
    shareId?: string
    path?: string
    content?: string
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    projectName?: string
    vmName?: string
    command?: string
    timeoutMs?: number
}

export default function useAiWorkbench({
    initialConversations,
    initialRepositories,
    initialShares,
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
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [participants, setParticipants] = useState(0)
    const [isConnected, setIsConnected] = useState(false)
    const [statusNotice, setStatusNotice] = useState<string | null>(null)
    const [conversations, setConversations] = useState<AIConversation[]>(initialConversations)
    const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || initialConversations[0]?.id || null)
    const [composer, setComposer] = useState('')
    const [search, setSearch] = useState('')
    const [importInput, setImportInput] = useState('')
    const [importError, setImportError] = useState<string | null>(null)
    const [importPending, setImportPending] = useState(false)
    const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null)
    const [importedRepos, setImportedRepos] = useState<AIImportedRepo[]>(initialRepositories)
    const [shares, setShares] = useState(initialShares)
    const [shareContents, setShareContents] = useState<Record<string, string>>({})
    const [shareTrees, setShareTrees] = useState<Record<string, Tree>>({})
    const [shareFileContents, setShareFileContents] = useState<Record<string, string>>({})

    useEffect(() => {
        conversationsRef.current = conversations
    }, [conversations])

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
        if (!isAuthenticated || bootstrappedRef.current || conversations.some((conversation) => !conversation.archivedAt)) {
            return
        }

        bootstrappedRef.current = true
        const timer = setTimeout(() => {
            void createNewConversationRef.current()
        }, 0)

        return () => clearTimeout(timer)
    }, [conversations, isAuthenticated])

    useEffect(() => {
        shouldReconnectRef.current = true

        const connect = () => {
            const ws = new WebSocket(`${config.url.api_client_wss}/client/ws/gpt`)
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
            const ws = new WebSocket(`${config.url.cdn_wss}/share/${share.alias}/shell/${userId}/${session}`)
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
                } catch {}
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
                } catch {}
            }
        })
    }, [shares])

    useEffect(() => {
        hydrateShareRef.current = async (shareId: string) => {
            const token = getCookie('access_token') || undefined
            const userId = getCookie('id') || undefined
            const share = await getShare({ id: shareId, token, userId })
            if (typeof share === 'string') {
                return null
            }

            setShareContents((prev) => ({ ...prev, [shareId]: share.content }))
            const tree = await getTree({ id: shareId, token, userId })
            if (tree) {
                setShareTrees((prev) => ({ ...prev, [shareId]: tree }))
            }
            return share
        }
    }, [])

    useEffect(() => {
        hydrateShareFileRef.current = async (rootId: string, filePath: string) => {
            const token = getCookie('access_token') || undefined
            const userId = getCookie('id') || undefined
            const rootTree = shareTrees[rootId] || await getTree({ id: rootId, token, userId })
            if (!rootTree) {
                return null
            }

            setShareTrees((prev) => ({ ...prev, [rootId]: rootTree }))
            const fileId = findTreeFileId(rootTree, filePath)
            if (!fileId) {
                return null
            }

            const share = await getShare({ id: fileId, token, userId })
            if (typeof share === 'string') {
                return null
            }

            const key = `${rootId}:${filePath}`
            setShareFileContents((prev) => ({ ...prev, [key]: share.content }))
            return share.content
        }
    }, [shareTrees])

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

    function updateLocalConversation(id: string, patch: Partial<AIConversation>) {
        setConversations((prev) => prev.map((conversation) => conversation.id === id
            ? {
                ...conversation,
                ...patch,
                title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : conversation.title,
                workspaceMeta: patch.workspaceMeta || conversation.workspaceMeta,
                shareIds: patch.shareIds || conversation.shareIds,
                updatedAt: new Date().toISOString(),
            }
            : conversation))
    }

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

    const patchConversation = useCallback(async (id: string, patch: Partial<AIConversation>) => {
        updateLocalConversation(id, patch)

        if (!isAuthenticated) {
            return
        }

        try {
            setStatusNotice(null)
            const response = await aiClientRequest(`/ai/conversations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(toConversationPayload({ id, ...patch } as AIConversation)),
            })
            if (!response.ok) {
                throw new Error('Unable to save conversation changes.')
            }
        } catch (error) {
            setStatusNotice(error instanceof Error ? error.message : 'Unable to save conversation changes.')
        }
    }, [isAuthenticated])

    async function renameConversation(id: string, title: string) {
        const nextTitle = title.trim() || 'New chat'
        await patchConversation(id, { title: nextTitle })
    }

    async function archiveConversation(id: string, archived: boolean) {
        await patchConversation(id, { archivedAt: archived ? new Date().toISOString() : null })
        if (archived && resolvedActiveConversationId === id) {
            const nextConversation = conversations.find((conversation) => conversation.id !== id && !conversation.archivedAt)
            if (nextConversation) {
                setActiveConversationId(nextConversation.id)
            } else {
                await createNewConversation()
            }
        }
    }

    async function deleteConversation(id: string) {
        const existing = conversations.find((conversation) => conversation.id === id)
        if (!existing) {
            return
        }

        setConversations((prev) => prev.filter((conversation) => conversation.id !== id))
        if (resolvedActiveConversationId === id) {
            const nextConversation = conversations.find((conversation) => conversation.id !== id && !conversation.archivedAt)
                || conversations.find((conversation) => conversation.id !== id)
                || null
            setActiveConversationId(nextConversation?.id || null)
        }

        if (!isAuthenticated) {
            return
        }

        try {
            setStatusNotice(null)
            const response = await aiClientRequest(`/ai/conversations/${id}`, {
                method: 'DELETE',
            })
            if (!response.ok) {
                throw new Error('Unable to delete the conversation.')
            }
        } catch (error) {
            setConversations((prev) => [existing, ...prev])
            setActiveConversationId(id)
            setStatusNotice(error instanceof Error ? error.message : 'Unable to delete the conversation.')
        }
    }

    const persistMessage = useCallback(async (conversationId: string, message: AIConversationMessage) => {
        if (!isAuthenticated) {
            return
        }

        try {
            const response = await aiClientRequest(`/ai/conversations/${conversationId}/messages`, {
                method: 'PUT',
                body: JSON.stringify({
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    pending: Boolean(message.pending),
                    error: Boolean(message.error),
                    modelName: message.modelName || null,
                    metadata: message.metadata || {},
                    createdAt: message.createdAt,
                }),
            })
            if (!response.ok) {
                throw new Error('Unable to persist the latest message.')
            }
        } catch (error) {
            setStatusNotice(error instanceof Error ? error.message : 'Unable to persist the latest message.')
        }
    }, [isAuthenticated])

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
            workspaceMeta: {
                ...activeConversation.workspaceMeta,
                selectedFilePath,
            },
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
            workspaceMeta: {
                ...activeConversation.workspaceMeta,
                repositoryId: repo.id,
                repositoryName: repo.fullName,
                repositoryBranch: repo.branch,
                repositorySourceUrl: repo.sourceUrl,
                selectedFilePath: repo.files[0]?.path || '',
            },
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
            const imported = await importGitHubRepository(importInput)
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

            if (existing) {
                await syncRepositoryToShare({ repo: pendingRepo, token, userId })
            } else {
                await importRepositoryToShare({ repo: pendingRepo, token, userId })
            }
            const pendingRepoId = pendingRepo.id
            setShareTrees((prev) => {
                const next = { ...prev }
                delete next[pendingRepoId]
                return next
            })
            setShareFileContents((prev) => Object.fromEntries(
                Object.entries(prev).filter(([key]) => !key.startsWith(`${pendingRepoId}:`))
            ))
            await hydrateShareRef.current(pendingRepoId)
            const readyRepo = withRepositorySync(pendingRepo, {
                status: 'ready',
                source: existing ? 'refresh' : 'import',
                message: existing ? 'Repository refresh complete.' : 'Repository imported into the editor workspace.',
            })
            upsertRepository(readyRepo)
            setImportInput('')
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
                } catch {}
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
            const refreshed = await importGitHubRepository(existing.sourceUrl, existing.id)
            const token = getCookie('access_token')
            const userId = getCookie('id')
            await syncRepositoryToShare({ repo: refreshed, token, userId })
            setShareTrees((prev) => {
                const next = { ...prev }
                delete next[repoId]
                return next
            })
            setShareFileContents((prev) => Object.fromEntries(
                Object.entries(prev).filter(([key]) => !key.startsWith(`${repoId}:`))
            ))
            await hydrateShareRef.current(repoId)
            const readyRepo = withRepositorySync(refreshed, {
                status: 'ready',
                source: 'refresh',
                message: 'Repository sync complete.',
            })
            upsertRepository(readyRepo)
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
            } catch {}
            setImportError(error instanceof Error ? error.message : 'Failed to refresh repository.')
        } finally {
            setSyncingRepoId(null)
        }
    }

    const selectRepoFile = useCallback(async (path: string) => {
        if (!activeConversation || typeof activeConversation.workspaceMeta?.repositoryId !== 'string' || !activeConversation.workspaceId) {
            return
        }

        await hydrateShareFileRef.current(activeConversation.workspaceId, path)
        await patchConversation(activeConversation.id, {
            workspaceMeta: {
                ...activeConversation.workspaceMeta,
                selectedFilePath: path,
            },
        })
    }, [activeConversation, patchConversation])

    const selectShareFile = useCallback(async (path: string) => {
        if (!activeConversation || !activeConversation.workspaceId) {
            return
        }

        await hydrateShareFileRef.current(activeConversation.workspaceId, path)
        await patchConversation(activeConversation.id, {
            workspaceMeta: {
                ...activeConversation.workspaceMeta,
                selectedFilePath: path,
            },
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
            setShareTrees((prev) => {
                const next = { ...prev }
                delete next[scaffold.rootId]
                return next
            })
            setShareFileContents((prev) => Object.fromEntries(
                Object.entries(prev).filter(([key]) => !key.startsWith(`${scaffold.rootId}:`))
            ))
            await attachShare(scaffold.rootId)
            await selectShareFile(scaffold.selectedFilePath)
            setStatusNotice(`Next.js + Docker workspace ready: ${scaffold.rootName}. Created ${scaffold.fileCount} files.`)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to scaffold the Next.js workspace.'
            setStatusNotice(message)
            throw new Error(message)
        }
    }, [activeConversation, attachShare, selectShareFile])

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

        const nextContent = message.type === 'prompt_complete'
            ? (message.content || lastMessage.content)
            : (message.error || lastMessage.content || 'The model failed to answer this prompt.')

        const assistantMessage: AIConversationMessage = {
            ...lastMessage,
            content: stripToolTags(nextContent).trim() || nextContent,
            pending: false,
            error: message.type === 'prompt_error',
            modelName: message.clientName || lastMessage.modelName || conversation.activeModel,
            metadata: {
                ...(lastMessage.metadata || {}),
                artifacts: message.artifacts || (lastMessage.metadata?.artifacts as AIArtifact[] | undefined) || [],
            },
        }

        await persistMessage(message.conversationId, assistantMessage)
        if (message.type === 'prompt_complete') {
            await executeAssistantToolsRef.current(conversation, assistantMessage)
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

            setConversations((prev) => prev.map((conversation) => {
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
            }))

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
                    metadata: { tool: toolCall.action },
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
        archivedConversations,
        archiveConversation,
        attachRepo,
        attachShare,
        clients,
        composer,
        createNewConversation,
        deleteConversation,
        filteredConversations,
        importError,
        importInput,
        importPending,
        importedRepos,
        initialShares: shares,
        isConnected,
        participants,
        refreshRepo,
        activeShareTree,
        selectedRepoFilePath,
        selectedShareContent,
        selectedShareFileContent,
        scaffoldStarter,
        selectConversation: setActiveConversationId,
        selectRepoFile,
        selectShareFile,
        sendPrompt,
        setComposer,
        setImportInput,
        setModelStrategy,
        setPreferredModel,
        setSearch,
        syncingRepoId,
        importRepo,
        isAuthenticated,
        renameConversation,
        search,
        statusNotice,
    }
}

function createConversation(clientName: string | null = null): AIConversation {
    const timestamp = new Date().toISOString()
    return {
        id: crypto.randomUUID(),
        title: 'New chat',
        preferredModel: clientName,
        activeModel: clientName,
        modelStrategy: 'auto',
        workspaceId: null,
        workspaceKind: null,
        shareIds: [],
        workspaceMeta: {},
        messages: [],
        metrics: defaultModelMetrics(),
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
    }
}

function withRepositorySync(
    repo: AIImportedRepo,
    update: {
        status: 'ready' | 'syncing' | 'error'
        source: 'import' | 'refresh' | 'sync'
        message: string
    },
): AIImportedRepo {
    const event: AIRepositorySyncEvent = {
        timestamp: new Date().toISOString(),
        status: update.status,
        source: update.source,
        message: update.message,
    }

    return {
        ...repo,
        syncStatus: update.status,
        lastSyncedAt: update.status === 'ready' ? event.timestamp : repo.lastSyncedAt,
        lastSyncError: update.status === 'error' ? update.message : null,
        syncHistory: [event, ...(repo.syncHistory || [])].slice(0, 10),
    }
}

function appendError(
    conversation: AIConversation,
    content: string,
    metrics?: GPT_ModelMetrics,
    modelName?: string | null,
): AIConversation {
    const messages = [...conversation.messages]
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.pending) {
        messages[messages.length - 1] = { ...lastMessage, content, pending: false, error: true, modelName: modelName || lastMessage.modelName || null }
    } else {
        messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            error: true,
            createdAt: new Date().toISOString(),
            modelName: modelName || null,
        })
    }

    return {
        ...conversation,
        updatedAt: new Date().toISOString(),
        metrics: metrics || { ...conversation.metrics, status: 'error', lastError: content },
        messages,
    }
}

function resolveModelName(conversation: AIConversation, clients: GPT_Client[]) {
    const names = clients.map((client) => client.name)
    return [conversation.preferredModel, conversation.activeModel, names[0]].find((name) => name && names.includes(name)) || null
}

async function buildWorkspaceContext(
    conversation: AIConversation,
    importedRepos: AIImportedRepo[],
    shareContents: Record<string, string>,
    shareTrees: Record<string, Tree>,
    shareFileContents: Record<string, string>,
) {
    const sections: string[] = []

    if (conversation.shareIds.length) {
        const activeShareId = conversation.workspaceId || conversation.shareIds[0]
        const shareSummary = conversation.shareIds.map((shareId) => {
            const content = shareContents[shareId] || ''
            const prefix = shareId === activeShareId ? 'active' : 'attached'
            return `${prefix} share ${shareId}:\n${content.slice(0, shareId === activeShareId ? 12000 : 2500)}`
        })
        sections.push(`Attached Hanasand shares:\n${shareSummary.join('\n\n')}`)
    }

    const repositoryId = typeof conversation.workspaceMeta?.repositoryId === 'string'
        ? conversation.workspaceMeta.repositoryId
        : conversation.workspaceKind === 'repo'
            ? conversation.workspaceId
            : null
    if (repositoryId) {
        const repo = importedRepos.find((item) => item.id === repositoryId)
        if (repo) {
            const rootId = conversation.workspaceId || repo.id
            const selectedPath = String(conversation.workspaceMeta?.selectedFilePath || repo.files[0]?.path || '')
            const selectedFile = repo.files.find((file) => file.path === selectedPath) || repo.files[0]
            const treePaths = listTreePaths(shareTrees[rootId])
            const liveContent = shareFileContents[`${rootId}:${selectedPath}`]
            sections.push([
                `Repository: ${repo.fullName} on branch ${repo.branch}.`,
                `Repository files:\n${(treePaths.length ? treePaths : repo.files.map((file) => file.path)).slice(0, 80).join('\n')}`,
                selectedFile ? `Focused file (${selectedFile.path}):\n${(liveContent || selectedFile.content).slice(0, 12000)}` : null,
            ].filter(Boolean).join('\n\n'))
        }
    }

    return sections.join('\n\n').trim()
}

function buildSystemPrompt({
    conversation,
    workspaceContext,
}: {
    conversation: AIConversation
    workspaceContext: string | null
}) {
    return [
        'You are Hanasand AI, an app-style coding assistant inside Hanasand.',
        'Behave like Codex inside Hanasand: be direct, calm, concise, practical, and action-oriented.',
        'Prefer concrete next steps, patch-ready code, and careful reasoning over marketing language.',
        'You have built-in access to advanced reasoning, repo-aware file inspection/editing tools, local command execution, managed background processes, Playwright browser verification, and live web search outside this prompt. Think privately, inspect before editing, verify in-browser when building web apps, and do not say you lack internet access, shell access, repository access, browser access, or current date awareness when those tools would help.',
        'If a capability is missing but can be added safely, improve your own workflow by creating reusable scripts, helpers, or tools rather than repeating the same manual sequence.',
        'If a preferred model is unavailable, continue the conversation seamlessly with the current connected model.',
        'When a user asks you to read or update an attached share, make an authenticated HTTP request, prepare a remote project, create a VM, or run a command in an attached share terminal, you may emit one or more tool tags on their own line.',
        'Supported tags:',
        '<hanasand-tool>{"action":"read_share","shareId":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"update_share","shareId":"optional","path":"optional","content":"new file content"}</hanasand-tool>',
        '<hanasand-tool>{"action":"http_request","url":"https://...","method":"GET","headers":{"Accept":"application/json"},"body":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"optional","shareId":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"create_vm","vmName":"northstar-admin"}</hanasand-tool>',
        '<hanasand-tool>{"action":"create_project","projectName":"Northstar Admin","vmName":"northstar-admin","shareId":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"run_terminal_command","shareId":"optional","command":"pwd && ls","timeoutMs":20000}</hanasand-tool>',
        'Only emit a tool tag when the user clearly asked for the action. Keep normal explanation outside the tag.',
        'Use scaffold_nextjs_docker or create_project when the user asks for a production-style starter, Dockerized Next.js app, or a full workspace you can keep extending from the browser.',
        `Conversation strategy: ${conversation.modelStrategy}. Preferred model: ${conversation.preferredModel || 'auto'}.`,
        workspaceContext ? `Workspace context:\n${workspaceContext}` : 'No workspace is attached yet.',
    ].join('\n\n')
}

function toConversationPayload(conversation: Partial<AIConversation>) {
    return {
        id: conversation.id,
        title: conversation.title,
        preferredModel: conversation.preferredModel ?? null,
        activeModel: conversation.activeModel ?? null,
        modelStrategy: conversation.modelStrategy ?? 'auto',
        workspaceKind: conversation.workspaceKind ?? null,
        workspaceId: conversation.workspaceId ?? null,
        shareIds: conversation.shareIds ?? [],
        workspaceMeta: conversation.workspaceMeta ?? {},
        archivedAt: conversation.archivedAt ?? null,
    }
}

function parseToolCalls(content: string): AiToolCall[] {
    const matches = [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)]
    const results: AiToolCall[] = []
    for (const match of matches) {
        try {
            const parsed = JSON.parse(match[1]) as AiToolCall
            if (parsed?.action) {
                results.push(parsed)
            }
        } catch (error) {
            console.error('Invalid Hanasand tool payload', error)
        }
    }
    return results
}

function stripToolTags(content: string) {
    return content.replace(/<hanasand-tool>[\s\S]*?<\/hanasand-tool>/g, '').replace(/\n{3,}/g, '\n\n')
}

function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `vm-${randomId(6).toLowerCase()}`
}
