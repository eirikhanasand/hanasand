'use client'

import { useCallback } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import { toConversationPayload } from './helpers'

type UseConversationActionsProps = {
    conversations: AIConversation[]
    isAuthenticated: boolean
    resolvedActiveConversationId: string | null
    setConversations: React.Dispatch<React.SetStateAction<AIConversation[]>>
    setActiveConversationId: React.Dispatch<React.SetStateAction<string | null>>
    setStatusNotice: React.Dispatch<React.SetStateAction<string | null>>
    createConversationFallback: () => Promise<void>
}

export function useConversationActions({
    conversations,
    isAuthenticated,
    resolvedActiveConversationId,
    setConversations,
    setActiveConversationId,
    setStatusNotice,
    createConversationFallback,
}: UseConversationActionsProps) {
    const updateLocalConversation = useCallback((id: string, patch: Partial<AIConversation>) => {
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
    }, [setConversations])

    const replaceConversation = useCallback((nextConversation: AIConversation) => {
        setConversations((prev) => {
            const existing = prev.find((conversation) => conversation.id === nextConversation.id)
            if (!existing) {
                return [nextConversation, ...prev]
            }

            return prev.map((conversation) => conversation.id === nextConversation.id
                ? {
                    ...conversation,
                    ...nextConversation,
                    messages: nextConversation.messages || conversation.messages,
                    metrics: nextConversation.metrics || conversation.metrics,
                    collaboration: nextConversation.collaboration || conversation.collaboration,
                }
                : conversation)
        })
    }, [setConversations])

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
    }, [isAuthenticated, setStatusNotice, updateLocalConversation])

    const renameConversation = useCallback(async (id: string, title: string) => {
        const nextTitle = title.trim() || 'New chat'
        await patchConversation(id, { title: nextTitle })
    }, [patchConversation])

    const archiveConversation = useCallback(async (id: string, archived: boolean) => {
        await patchConversation(id, { archivedAt: archived ? new Date().toISOString() : null })
        if (archived && resolvedActiveConversationId === id) {
            const nextConversation = conversations.find((conversation) => conversation.id !== id && !conversation.archivedAt)
            if (nextConversation) {
                setActiveConversationId(nextConversation.id)
            } else {
                await createConversationFallback()
            }
        }
    }, [conversations, createConversationFallback, patchConversation, resolvedActiveConversationId, setActiveConversationId])

    const deleteConversation = useCallback(async (id: string) => {
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
    }, [conversations, isAuthenticated, resolvedActiveConversationId, setActiveConversationId, setConversations, setStatusNotice])

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
    }, [isAuthenticated, setStatusNotice])

    return {
        updateLocalConversation,
        replaceConversation,
        patchConversation,
        renameConversation,
        archiveConversation,
        deleteConversation,
        persistMessage,
    }
}
