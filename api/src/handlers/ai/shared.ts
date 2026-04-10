import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import run from '#db'

export type AiConversationRow = {
    id: string
    owner_id: string
    title: string
    preferred_model: string | null
    active_model: string | null
    model_strategy: 'auto' | 'pinned'
    workspace_kind: 'share' | 'repo' | null
    workspace_id: string | null
    share_ids: string[] | null
    workspace_meta: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

export type AiMessageRow = {
    id: string
    conversation_id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    pending: boolean
    error: boolean
    model_name: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

export async function requireAiUser(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return null
    }

    return auth.id
}

export async function getConversationForUser(conversationId: string, ownerId: string) {
    const result = await run(`
        SELECT *
        FROM ai_conversations
        WHERE id = $1
          AND owner_id = $2
    `, [conversationId, ownerId])

    return (result.rows as AiConversationRow[])[0] || null
}

export async function getWorkspaceBundle(ownerId: string) {
    const [conversationResult, messageResult, repositoryResult, fileResult] = await Promise.all([
        run(`
            SELECT *
            FROM ai_conversations
            WHERE owner_id = $1
            ORDER BY updated_at DESC, created_at DESC
        `, [ownerId]),
        run(`
            SELECT ai_messages.*
            FROM ai_messages
            JOIN ai_conversations
              ON ai_conversations.id = ai_messages.conversation_id
            WHERE ai_conversations.owner_id = $1
            ORDER BY ai_messages.created_at ASC
        `, [ownerId]),
        run(`
            SELECT *
            FROM ai_imported_repositories
            WHERE owner_id = $1
            ORDER BY imported_at DESC
        `, [ownerId]),
        run(`
            SELECT files.*
            FROM ai_imported_repository_files AS files
            JOIN ai_imported_repositories AS repositories
              ON repositories.id = files.repository_id
            WHERE repositories.owner_id = $1
            ORDER BY files.path ASC
        `, [ownerId]),
    ])

    const conversations = conversationResult.rows as AiConversationRow[]
    const messages = messageResult.rows as AiMessageRow[]
    const repositories = repositoryResult.rows as {
        id: string
        name: string
        full_name: string
        branch: string
        default_branch: string
        source_path: string
        source_url: string
        truncated: boolean
        imported_at: string
    }[]
    const files = fileResult.rows as {
        repository_id: string
        path: string
        name: string
        content: string
    }[]

    const messagesByConversation = new Map<string, AiMessageRow[]>()
    for (const message of messages) {
        const bucket = messagesByConversation.get(message.conversation_id) || []
        bucket.push(message)
        messagesByConversation.set(message.conversation_id, bucket)
    }

    const filesByRepository = new Map<string, { path: string, name: string, content: string }[]>()
    for (const file of files) {
        const bucket = filesByRepository.get(file.repository_id) || []
        bucket.push({ path: file.path, name: file.name, content: file.content })
        filesByRepository.set(file.repository_id, bucket)
    }

    return {
        conversations: conversations.map((conversation) =>
            toAiConversation(conversation, messagesByConversation.get(conversation.id) || [])
        ),
        repositories: repositories.map((repository) => ({
            id: repository.id,
            name: repository.name,
            fullName: repository.full_name,
            branch: repository.branch,
            defaultBranch: repository.default_branch,
            sourcePath: repository.source_path,
            sourceUrl: repository.source_url,
            truncated: repository.truncated,
            importedAt: repository.imported_at,
            files: filesByRepository.get(repository.id) || [],
        })),
    }
}

export function toAiConversation(conversation: AiConversationRow, messages: AiMessageRow[] = []) {
    return {
        id: conversation.id,
        title: conversation.title,
        preferredModel: conversation.preferred_model,
        activeModel: conversation.active_model,
        modelStrategy: conversation.model_strategy,
        workspaceId: conversation.workspace_id,
        workspaceKind: conversation.workspace_kind,
        shareIds: conversation.share_ids || [],
        workspaceMeta: conversation.workspace_meta || {},
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            pending: message.pending,
            error: message.error,
            modelName: message.model_name,
            metadata: message.metadata || {},
            createdAt: message.created_at,
            updatedAt: message.updated_at,
        })),
    }
}
