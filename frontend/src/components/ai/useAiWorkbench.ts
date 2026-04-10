'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { getShare } from '@/utils/share/get'
import { getTree } from '@/utils/share/getTree'
import { updateShare } from '@/utils/share/put'
import defaultModelMetrics from '@/components/gpt/defaultModelMetrics'
import normalizeClient from '@/components/gpt/normalizeClient'
import { aiClientRequest } from '@/utils/ai/client'
import { importRepositoryToShare } from '@/utils/ai/importRepositoryToShare'
import { syncRepositoryToShare } from '@/utils/ai/syncRepositoryToShare'
import { importGitHubRepository } from './github'
import { findTreeFileId, listTreePaths } from './shareTree'

type UseAiWorkbenchProps = {
    initialConversations: AIConversation[]
    initialRepositories: AIImportedRepo[]
    initialShares: Share[]
    isAuthenticated: boolean
}

export default function useAiWorkbench({
    initialConversations,
    initialRepositories,
    initialShares,
    isAuthenticated,
}: UseAiWorkbenchProps) {
    const socketRef = useRef<WebSocket | null>(null)
    const bootstrappedRef = useRef(false)
    const conversationsRef = useRef<AIConversation[]>(initialConversations)
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [participants, setParticipants] = useState(0)
    const [isConnected, setIsConnected] = useState(false)
    const [conversations, setConversations] = useState<AIConversation[]>(initialConversations)
    const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversations[0]?.id || null)
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
        setConversations(initialConversations)
        setImportedRepos(initialRepositories)
        setShares(initialShares)
        setActiveConversationId((prev) => prev || initialConversations[0]?.id || null)
    }, [initialConversations, initialRepositories, initialShares])

    useEffect(() => {
        conversationsRef.current = conversations
    }, [conversations])

    useEffect(() => {
        if (!isAuthenticated || bootstrappedRef.current || conversations.length) {
            return
        }

        bootstrappedRef.current = true
        void createNewConversation()
    }, [conversations.length, isAuthenticated])

    useEffect(() => {
        const ws = new WebSocket(`${config.url.api_client_wss}/client/ws/gpt`)
        socketRef.current = ws

        ws.onopen = () => setIsConnected(true)
        ws.onclose = () => {
            setIsConnected(false)
            socketRef.current = null
        }
        ws.onerror = () => setIsConnected(false)
        ws.onmessage = (event) => {
            try {
                handleSocketMessage(JSON.parse(event.data) as GptSocketMessage)
            } catch (error) {
                console.error('Invalid AI socket payload', error)
            }
        }

        return () => ws.close()
    }, [])

    const filteredConversations = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) {
            return conversations
        }

        return conversations.filter((conversation) =>
            conversation.title.toLowerCase().includes(query)
            || conversation.messages.some((message) => message.content.toLowerCase().includes(query))
            || (conversation.preferredModel || '').toLowerCase().includes(query)
        )
    }, [conversations, search])

    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
        [activeConversationId, conversations]
    )

    const selectedRepoFilePath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
        ? activeConversation.workspaceMeta.selectedFilePath
        : null
    const selectedShareContent = activeConversation?.workspaceId
        ? shareContents[activeConversation.workspaceId] || null
        : null

    useEffect(() => {
        if (!activeConversation?.shareIds?.length) {
            return
        }

        for (const shareId of activeConversation.shareIds) {
            if (!shareContents[shareId]) {
                void hydrateShare(shareId)
            }
        }
    }, [activeConversation, shareContents])

    useEffect(() => {
        const selectedPath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
            ? activeConversation.workspaceMeta.selectedFilePath
            : null
        if (!activeConversation?.workspaceId || !selectedPath) {
            return
        }

        const key = `${activeConversation.workspaceId}:${selectedPath}`
        if (!shareFileContents[key]) {
            void hydrateShareFile(activeConversation.workspaceId, selectedPath)
        }
    }, [activeConversation, shareFileContents])

    async function hydrateShare(shareId: string) {
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

    async function hydrateShareFile(rootId: string, filePath: string) {
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

    async function createNewConversation() {
        const conversation = createConversation(clients[0]?.name || null)
        setConversations((prev) => [conversation, ...prev])
        setActiveConversationId(conversation.id)

        if (!isAuthenticated) {
            return
        }

        await aiClientRequest('/ai/conversations', {
            method: 'POST',
            body: JSON.stringify(toConversationPayload(conversation)),
        })
    }

    async function patchConversation(id: string, patch: Partial<AIConversation>) {
        setConversations((prev) => prev.map((conversation) => conversation.id === id
            ? {
                ...conversation,
                ...patch,
                workspaceMeta: patch.workspaceMeta || conversation.workspaceMeta,
                shareIds: patch.shareIds || conversation.shareIds,
                updatedAt: new Date().toISOString(),
            }
            : conversation))

        if (!isAuthenticated) {
            return
        }

        await aiClientRequest(`/ai/conversations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(toConversationPayload({ id, ...patch } as AIConversation)),
        })
    }

    async function persistMessage(conversationId: string, message: AIConversationMessage) {
        if (!isAuthenticated) {
            return
        }

        await aiClientRequest(`/ai/conversations/${conversationId}/messages`, {
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
    }

    async function attachShare(shareId: string) {
        if (!activeConversation) {
            return
        }

        const nextShareIds = Array.from(new Set([shareId, ...(activeConversation.shareIds || [])]))
        await patchConversation(activeConversation.id, {
            workspaceId: shareId,
            workspaceKind: 'share',
            shareIds: nextShareIds,
        })
        await hydrateShare(shareId)
        if (typeof activeConversation.workspaceMeta?.selectedFilePath === 'string') {
            await hydrateShareFile(shareId, activeConversation.workspaceMeta.selectedFilePath)
        }
    }

    async function attachRepo(repoId: string, importedRepo?: AIImportedRepo) {
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
        await hydrateShare(shareId)
        if (repo.files[0]?.path) {
            await hydrateShareFile(shareId, repo.files[0].path)
        }
    }

    async function importRepo() {
        if (!importInput.trim()) {
            return
        }

        setImportPending(true)
        setImportError(null)
        try {
            const imported = await importGitHubRepository(importInput)
            const existing = importedRepos.find((repo) =>
                repo.fullName === imported.fullName
                && repo.branch === imported.branch
                && repo.sourcePath === imported.sourcePath
            )
            const repo = existing ? { ...imported, id: existing.id } : imported
            const token = getCookie('access_token')
            const userId = getCookie('id')
            if (existing) {
                await syncRepositoryToShare({ repo, token, userId })
            } else {
                await importRepositoryToShare({ repo, token, userId })
            }
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
                owner: userId || '',
                parent: '',
            }, ...prev.filter((entry) => entry.id !== repo.id)])
            setImportInput('')

            if (isAuthenticated) {
                await aiClientRequest('/ai/repositories', {
                    method: 'POST',
                    body: JSON.stringify(repo),
                })
            }

            await attachRepo(repo.id, repo)
        } catch (error) {
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
            const refreshed = await importGitHubRepository(existing.sourceUrl, existing.id)
            const token = getCookie('access_token')
            const userId = getCookie('id')
            await syncRepositoryToShare({ repo: refreshed, token, userId })
            setImportedRepos((prev) => [refreshed, ...prev.filter((entry) => entry.id !== repoId)])
            if (isAuthenticated) {
                await aiClientRequest('/ai/repositories', {
                    method: 'POST',
                    body: JSON.stringify(refreshed),
                })
            }
            if (activeConversation?.workspaceMeta?.repositoryId === repoId) {
                await attachRepo(repoId, refreshed)
            }
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'Failed to refresh repository.')
        } finally {
            setSyncingRepoId(null)
        }
    }

    async function selectRepoFile(path: string) {
        if (!activeConversation || typeof activeConversation.workspaceMeta?.repositoryId !== 'string' || !activeConversation.workspaceId) {
            return
        }

        await hydrateShareFile(activeConversation.workspaceId, path)
        await patchConversation(activeConversation.id, {
            workspaceMeta: {
                ...activeConversation.workspaceMeta,
                selectedFilePath: path,
            },
        })
    }

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

    function handleSocketMessage(message: GptSocketMessage) {
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

            if (message.type === 'prompt_delta' || message.type === 'prompt_complete') {
                const messages = [...conversation.messages]
                const lastMessage = messages[messages.length - 1]
                if (lastMessage?.role === 'assistant') {
                    messages[messages.length - 1] = {
                        ...lastMessage,
                        modelName: message.clientName || lastMessage.modelName || conversation.activeModel,
                        content: message.content || `${lastMessage.content}${message.delta || ''}`,
                        pending: message.type === 'prompt_delta',
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
                void persistConversationTail(message.conversationId)
            }, 0)
        }
    }

    async function persistConversationTail(conversationId?: string) {
        if (!conversationId) {
            return
        }

        const conversation = conversationsRef.current.find((entry) => entry.id === conversationId)
        if (!conversation) {
            return
        }

        const lastMessage = conversation.messages[conversation.messages.length - 1]
        if (!lastMessage) {
            return
        }

        if (lastMessage.role === 'assistant' && !lastMessage.pending) {
            const cleaned = stripToolTags(lastMessage.content).trim()
            const assistantMessage = {
                ...lastMessage,
                content: cleaned || lastMessage.content,
                pending: false,
            }
            await persistMessage(conversationId, assistantMessage)
            await executeAssistantTools(conversation, assistantMessage)
        } else {
            await persistMessage(conversationId, lastMessage)
        }
    }

    async function executeAssistantTools(conversation: AIConversation, message: AIConversationMessage) {
        const toolCalls = parseToolCalls(message.content)
        if (!toolCalls.length) {
            return
        }

        for (const toolCall of toolCalls) {
            const result = await runToolCall(conversation, toolCall)
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

    async function runToolCall(conversation: AIConversation, toolCall: AiToolCall) {
        if (toolCall.action === 'read_share') {
            const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
            if (!shareId) {
                return { ok: false, message: 'Tool failed: no share is attached to this conversation.' }
            }

            const share = await hydrateShare(shareId)
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

        return { ok: false, message: `Tool failed: unsupported action ${toolCall.action}.` }
    }

    return {
        activeConversation,
        activeConversationId,
        attachRepo,
        attachShare,
        clients,
        composer,
        createNewConversation,
        filteredConversations,
        importError,
        importInput,
        importPending,
        importedRepos,
        initialShares: shares,
        isConnected,
        participants,
        refreshRepo,
        selectedRepoFilePath,
        selectedShareContent,
        selectConversation: setActiveConversationId,
        selectRepoFile,
        sendPrompt,
        setComposer,
        setImportInput,
        setModelStrategy,
        setPreferredModel,
        setSearch,
        syncingRepoId,
        importRepo,
        isAuthenticated,
        search,
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
        createdAt: timestamp,
        updatedAt: timestamp,
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
        'Behave like a practical coding partner: be direct, calm, concise, and action-oriented.',
        'Prefer concrete next steps, patch-ready code, and careful reasoning over marketing language.',
        'If a preferred model is unavailable, continue the conversation seamlessly with the current connected model.',
        'When a user asks you to read or update an attached share, or to make an authenticated HTTP request for them, you may emit one or more tool tags on their own line.',
        'Supported tags:',
        '<hanasand-tool>{"action":"read_share","shareId":"optional"}</hanasand-tool>',
        '<hanasand-tool>{"action":"update_share","shareId":"optional","path":"optional","content":"new file content"}</hanasand-tool>',
        '<hanasand-tool>{"action":"http_request","url":"https://...","method":"GET","headers":{"Accept":"application/json"},"body":"optional"}</hanasand-tool>',
        'Only emit a tool tag when the user clearly asked for the action. Keep normal explanation outside the tag.',
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
    }
}

type AiToolCall = {
    action: 'read_share' | 'update_share' | 'http_request'
    shareId?: string
    path?: string
    content?: string
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
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
