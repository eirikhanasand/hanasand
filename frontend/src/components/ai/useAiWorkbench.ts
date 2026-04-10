'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { getShare } from '@/utils/share/get'
import defaultModelMetrics from '@/components/gpt/defaultModelMetrics'
import normalizeClient from '@/components/gpt/normalizeClient'
import { importGitHubRepository } from './github'

const CONVERSATIONS_KEY = 'hanasand-ai-conversations'
const REPOS_KEY = 'hanasand-ai-imported-repos'

export default function useAiWorkbench(initialShares: Share[]) {
    const socketRef = useRef<WebSocket | null>(null)
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [participants, setParticipants] = useState(0)
    const [isConnected, setIsConnected] = useState(false)
    const [conversations, setConversations] = useState<AIConversation[]>([])
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
    const [composer, setComposer] = useState('')
    const [search, setSearch] = useState('')
    const [importInput, setImportInput] = useState('')
    const [importError, setImportError] = useState<string | null>(null)
    const [importPending, setImportPending] = useState(false)
    const [importedRepos, setImportedRepos] = useState<AIImportedRepo[]>([])
    const [selectedRepoFilePathByRepo, setSelectedRepoFilePathByRepo] = useState<Record<string, string>>({})
    const [shareContents, setShareContents] = useState<Record<string, string>>({})

    useEffect(() => {
        const storedConversations = readStorage<AIConversation[]>(CONVERSATIONS_KEY, [])
        const storedRepos = readStorage<AIImportedRepo[]>(REPOS_KEY, [])
        const nextConversations = storedConversations.length ? storedConversations : [createConversation()]
        setConversations(nextConversations)
        setActiveConversationId(nextConversations[0]?.id || null)
        setImportedRepos(storedRepos)
    }, [])

    useEffect(() => {
        window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
    }, [conversations])

    useEffect(() => {
        window.localStorage.setItem(REPOS_KEY, JSON.stringify(importedRepos))
    }, [importedRepos])

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
        )
    }, [conversations, search])

    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
        [activeConversationId, conversations]
    )

    const selectedRepoFilePath = activeConversation?.workspaceKind === 'repo' && activeConversation.workspaceId
        ? selectedRepoFilePathByRepo[activeConversation.workspaceId] || null
        : null
    const selectedShareContent = activeConversation?.workspaceKind === 'share' && activeConversation.workspaceId
        ? shareContents[activeConversation.workspaceId] || null
        : null

    useEffect(() => {
        if (!activeConversation || activeConversation.workspaceKind !== 'share' || !activeConversation.workspaceId || shareContents[activeConversation.workspaceId]) {
            return
        }

        void hydrateShare(activeConversation.workspaceId)
    }, [activeConversation, shareContents])

    async function hydrateShare(shareId: string) {
        const token = getCookie('access_token') || undefined
        const userId = getCookie('id') || undefined
        const share = await getShare({ id: shareId, token, userId })
        if (typeof share === 'string') {
            return
        }

        setShareContents((prev) => ({ ...prev, [shareId]: share.content }))
    }

    function createNewConversation() {
        const conversation = createConversation(clients[0]?.name || null)
        setConversations((prev) => [conversation, ...prev])
        setActiveConversationId(conversation.id)
    }

    function attachShare(shareId: string) {
        setConversations((prev) => prev.map((conversation) => conversation.id === activeConversationId
            ? { ...conversation, workspaceId: shareId, workspaceKind: 'share', updatedAt: new Date().toISOString() }
            : conversation))
    }

    function attachRepo(repoId: string, importedRepo?: AIImportedRepo) {
        const repo = importedRepo || importedRepos.find((item) => item.id === repoId)
        if (!repo) {
            return
        }

        setSelectedRepoFilePathByRepo((prev) => ({
            ...prev,
            [repoId]: prev[repoId] || repo.files[0]?.path || '',
        }))
        setConversations((prev) => prev.map((conversation) => conversation.id === activeConversationId
            ? { ...conversation, workspaceId: repoId, workspaceKind: 'repo', updatedAt: new Date().toISOString() }
            : conversation))
    }

    async function importRepo() {
        if (!importInput.trim()) {
            return
        }

        setImportPending(true)
        setImportError(null)
        try {
            const repo = await importGitHubRepository(importInput)
            setImportedRepos((prev) => [repo, ...prev])
            setSelectedRepoFilePathByRepo((prev) => ({ ...prev, [repo.id]: repo.files[0]?.path || '' }))
            setImportInput('')
            attachRepo(repo.id, repo)
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'Failed to import repository.')
        } finally {
            setImportPending(false)
        }
    }

    function selectRepoFile(path: string) {
        if (!activeConversation?.workspaceId) {
            return
        }

        setSelectedRepoFilePathByRepo((prev) => ({
            ...prev,
            [activeConversation.workspaceId!]: path,
        }))
    }

    async function sendPrompt() {
        const prompt = composer.trim()
        if (!prompt || !activeConversation) {
            return
        }

        const socket = socketRef.current
        const clientName = activeConversation.clientName || clients[0]?.name || null
        if (!socket || socket.readyState !== WebSocket.OPEN || !clientName) {
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
        }
        const assistantMessage: AIConversationMessage = {
            id: `${activeConversation.id}-assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            pending: true,
            createdAt: new Date().toISOString(),
        }
        const workspaceContext = await buildWorkspaceContext(activeConversation, importedRepos, selectedRepoFilePathByRepo, shareContents)
        const requestMessages = [...activeConversation.messages, userMessage]
            .filter((message) => message.role === 'user' || message.role === 'assistant')
            .map((message) => ({ role: message.role, content: message.content }))
        const messages = workspaceContext
            ? [{ role: 'system' as const, content: workspaceContext }, ...requestMessages]
            : requestMessages

        setConversations((prev) => prev.map((conversation) => conversation.id === activeConversation.id
            ? {
                ...conversation,
                clientName,
                title: conversation.messages.length ? conversation.title : prompt.slice(0, 48),
                updatedAt: new Date().toISOString(),
                messages: [...conversation.messages, userMessage, assistantMessage],
            }
            : conversation))
        setComposer('')

        socket.send(JSON.stringify({
            type: 'prompt_request',
            conversationId: activeConversation.id,
            clientName,
            messages,
            maxTokens: 512,
            temperature: 0.7,
        }))
    }

    function handleSocketMessage(message: GptSocketMessage) {
        if (message.type === 'join') {
            setParticipants(message.participants || 0)
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
                conversation.clientName === normalizedClient.name
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
                        content: message.content || `${lastMessage.content}${message.delta || ''}`,
                        pending: message.type === 'prompt_delta',
                    }
                }

                return {
                    ...conversation,
                    updatedAt: new Date().toISOString(),
                    metrics: message.metrics || conversation.metrics,
                    messages,
                }
            }

            if (message.type === 'prompt_error') {
                return appendError(conversation, message.error || 'The model failed to answer this prompt.', message.metrics)
            }

            return conversation
        }))
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
        initialShares,
        isConnected,
        participants,
        selectedRepoFilePath,
        selectedShareContent,
        selectConversation: setActiveConversationId,
        selectRepoFile,
        sendPrompt,
        setComposer,
        setImportInput,
        setSearch,
        importRepo,
        search,
    }
}

function readStorage<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
        return fallback
    }

    const raw = window.localStorage.getItem(key)
    if (!raw) {
        return fallback
    }

    try {
        return JSON.parse(raw) as T
    } catch {
        return fallback
    }
}

function createConversation(clientName: string | null = null): AIConversation {
    const timestamp = new Date().toISOString()
    return {
        id: crypto.randomUUID(),
        title: 'New chat',
        clientName,
        workspaceId: null,
        workspaceKind: null,
        messages: [],
        metrics: defaultModelMetrics(),
        createdAt: timestamp,
        updatedAt: timestamp,
    }
}

function appendError(conversation: AIConversation, content: string, metrics?: GPT_ModelMetrics): AIConversation {
    const messages = [...conversation.messages]
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.pending) {
        messages[messages.length - 1] = { ...lastMessage, content, pending: false, error: true }
    } else {
        messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            error: true,
            createdAt: new Date().toISOString(),
        })
    }

    return {
        ...conversation,
        updatedAt: new Date().toISOString(),
        metrics: metrics || { ...conversation.metrics, status: 'error', lastError: content },
        messages,
    }
}

async function buildWorkspaceContext(
    conversation: AIConversation,
    importedRepos: AIImportedRepo[],
    selectedRepoFilePathByRepo: Record<string, string>,
    shareContents: Record<string, string>,
) {
    if (conversation.workspaceKind === 'share' && conversation.workspaceId) {
        const content = shareContents[conversation.workspaceId]
        if (!content) {
            return null
        }

        return `You are assisting with a Hanasand share workspace.\nShare id: ${conversation.workspaceId}\nCurrent content:\n${content.slice(0, 12000)}`
    }

    if (conversation.workspaceKind === 'repo' && conversation.workspaceId) {
        const repo = importedRepos.find((item) => item.id === conversation.workspaceId)
        if (!repo) {
            return null
        }

        const selectedPath = selectedRepoFilePathByRepo[repo.id] || repo.files[0]?.path
        const selectedFile = repo.files.find((file) => file.path === selectedPath) || repo.files[0]
        const fileList = repo.files.slice(0, 60).map((file) => file.path).join('\n')
        return [
            `You are assisting with the repository ${repo.fullName} on branch ${repo.branch}.`,
            `Repository files:\n${fileList}`,
            selectedFile ? `Focused file (${selectedFile.path}):\n${selectedFile.content.slice(0, 12000)}` : null,
        ].filter(Boolean).join('\n\n')
    }

    return null
}
