import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import run from '#db'
import { listGptClients, gpt } from '#utils/ws/handleGptMessage.ts'
import { buildAiRuntimeState } from './runtime.ts'
import { toRepoCredentialSummary } from '#utils/ai/repoCredentials.ts'
import { buildAiPreviewUrl } from '#utils/ai/preview.ts'

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
    archived_at: string | null
    created_at: string
    updated_at: string
    access_role?: 'owner' | 'reviewer' | 'editor'
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

type DeploymentRow = {
    id: string
    owner_id: string
    conversation_id: string
    repository_id: string | null
    workspace_kind: 'share' | 'repo' | null
    workspace_id: string | null
    vm_name: string
    service_name: string
    stack_type: AIStackType
    access_policy: AIDeploymentAccessPolicy
    started_by: string | null
    status: AIDeploymentStatus
    preview_url: string | null
    healthcheck_url: string | null
    events: AIDeploymentEvent[] | null
    failure_reason: string | null
    created_at: string
    updated_at: string
    completed_at: string | null
}

type ReleaseRow = {
    id: string
    owner_id: string
    conversation_id: string
    deployment_id: string | null
    vm_name: string
    stack_type: AIStackType
    access_policy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    preview_url: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    notes: string | null
}

type CollaborationRow = {
    conversation_id: string
    user_id: string
    role: 'reviewer' | 'editor'
    invited_by: string | null
    created_at: string
    user_name: string | null
    user_avatar: string | null
}

type UsageRow = {
    owner_id: string
    actor_id: string | null
    conversation_id: string | null
    deployment_id: string | null
    release_id: string | null
    kind: AIUsageEventKind
    units: number
    metadata: Record<string, unknown> | null
    created_at: string
    actor_name: string | null
    owner_name: string | null
}

type VmOwnershipRow = {
    name: string
    owner: string
    created_by: string
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
        SELECT ai_conversations.*,
               CASE
                   WHEN ai_conversations.owner_id = $2 THEN 'owner'
                   ELSE collaborators.role
               END AS access_role
        FROM ai_conversations
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_conversations.id
         AND collaborators.user_id = $2
        WHERE ai_conversations.id = $1
          AND (
              ai_conversations.owner_id = $2
              OR collaborators.user_id = $2
          )
    `, [conversationId, ownerId])

    return (result.rows as AiConversationRow[])[0] || null
}

export async function getConversationCollaborators(conversationId: string) {
    const result = await run(`
        SELECT collaborators.*, users.name AS user_name, users.avatar AS user_avatar
        FROM ai_conversation_collaborators AS collaborators
        LEFT JOIN users
          ON users.id = collaborators.user_id
        WHERE collaborators.conversation_id = $1
        ORDER BY collaborators.created_at ASC
    `, [conversationId])

    return result.rows as CollaborationRow[]
}

export async function getWorkspaceBundle(ownerId: string) {
    const [conversationResult, messageResult, repositoryResult, fileResult, deploymentResult, collaborationResult, releaseResult, usageResult] = await Promise.all([
        run(`
            SELECT ai_conversations.*,
                   CASE
                       WHEN ai_conversations.owner_id = $1 THEN 'owner'
                       ELSE collaborators.role
                   END AS access_role
            FROM ai_conversations
            LEFT JOIN ai_conversation_collaborators AS collaborators
              ON collaborators.conversation_id = ai_conversations.id
             AND collaborators.user_id = $1
            WHERE ai_conversations.owner_id = $1
               OR collaborators.user_id = $1
            ORDER BY updated_at DESC, created_at DESC
        `, [ownerId]),
        run(`
            SELECT ai_messages.*
            FROM ai_messages
            JOIN ai_conversations
              ON ai_conversations.id = ai_messages.conversation_id
            LEFT JOIN ai_conversation_collaborators AS collaborators
              ON collaborators.conversation_id = ai_conversations.id
             AND collaborators.user_id = $1
            WHERE ai_conversations.owner_id = $1
               OR collaborators.user_id = $1
            ORDER BY ai_messages.created_at ASC
        `, [ownerId]),
        run(`
            WITH accessible_conversations AS (
                SELECT ai_conversations.id,
                       ai_conversations.owner_id,
                       ai_conversations.workspace_kind,
                       ai_conversations.workspace_id,
                       ai_conversations.workspace_meta
                FROM ai_conversations
                LEFT JOIN ai_conversation_collaborators AS collaborators
                  ON collaborators.conversation_id = ai_conversations.id
                 AND collaborators.user_id = $1
                WHERE ai_conversations.owner_id = $1
                   OR collaborators.user_id = $1
            ),
            accessible_repo_ids AS (
                SELECT DISTINCT
                    CASE
                        WHEN workspace_kind = 'repo' THEN workspace_id
                        WHEN jsonb_typeof(workspace_meta) = 'object' THEN workspace_meta->>'repositoryId'
                        ELSE NULL
                    END AS repository_id
                FROM accessible_conversations
            )
            SELECT repositories.*
            FROM ai_imported_repositories AS repositories
            WHERE repositories.owner_id = $1
               OR repositories.id IN (
                    SELECT repository_id
                    FROM accessible_repo_ids
                    WHERE repository_id IS NOT NULL
               )
            ORDER BY repositories.imported_at DESC
        `, [ownerId]),
        run(`
            WITH accessible_conversations AS (
                SELECT ai_conversations.workspace_kind,
                       ai_conversations.workspace_id,
                       ai_conversations.workspace_meta
                FROM ai_conversations
                LEFT JOIN ai_conversation_collaborators AS collaborators
                  ON collaborators.conversation_id = ai_conversations.id
                 AND collaborators.user_id = $1
                WHERE ai_conversations.owner_id = $1
                   OR collaborators.user_id = $1
            ),
            accessible_repo_ids AS (
                SELECT DISTINCT
                    CASE
                        WHEN workspace_kind = 'repo' THEN workspace_id
                        WHEN jsonb_typeof(workspace_meta) = 'object' THEN workspace_meta->>'repositoryId'
                        ELSE NULL
                    END AS repository_id
                FROM accessible_conversations
            )
            SELECT files.*
            FROM ai_imported_repository_files AS files
            JOIN ai_imported_repositories AS repositories
              ON repositories.id = files.repository_id
            WHERE repositories.owner_id = $1
               OR repositories.id IN (
                    SELECT repository_id
                    FROM accessible_repo_ids
                    WHERE repository_id IS NOT NULL
               )
            ORDER BY files.path ASC
        `, [ownerId]),
        run(`
            SELECT ai_deployments.*
            FROM ai_deployments
            JOIN ai_conversations
              ON ai_conversations.id = ai_deployments.conversation_id
            LEFT JOIN ai_conversation_collaborators AS collaborators
              ON collaborators.conversation_id = ai_deployments.conversation_id
             AND collaborators.user_id = $1
            WHERE ai_deployments.owner_id = $1
               OR collaborators.user_id = $1
            ORDER BY ai_deployments.updated_at DESC, ai_deployments.created_at DESC
            LIMIT 25
        `, [ownerId]),
        run(`
            SELECT collaborators.*, users.name AS user_name, users.avatar AS user_avatar
            FROM ai_conversation_collaborators AS collaborators
            LEFT JOIN users
              ON users.id = collaborators.user_id
            WHERE collaborators.conversation_id IN (
                SELECT ai_conversations.id
                FROM ai_conversations
                LEFT JOIN ai_conversation_collaborators AS own_access
                  ON own_access.conversation_id = ai_conversations.id
                 AND own_access.user_id = $1
                WHERE ai_conversations.owner_id = $1
                   OR own_access.user_id = $1
            )
            ORDER BY collaborators.created_at ASC
        `, [ownerId]),
        run(`
            SELECT ai_releases.*
            FROM ai_releases
            JOIN ai_conversations
              ON ai_conversations.id = ai_releases.conversation_id
            LEFT JOIN ai_conversation_collaborators AS collaborators
              ON collaborators.conversation_id = ai_releases.conversation_id
             AND collaborators.user_id = $1
            WHERE ai_releases.owner_id = $1
               OR collaborators.user_id = $1
            ORDER BY ai_releases.updated_at DESC, ai_releases.created_at DESC
            LIMIT 40
        `, [ownerId]),
        run(`
            SELECT events.*, actor.name AS actor_name, owner.name AS owner_name
            FROM ai_usage_events AS events
            LEFT JOIN users AS actor
              ON actor.id = events.actor_id
            LEFT JOIN users AS owner
              ON owner.id = events.owner_id
            LEFT JOIN ai_conversation_collaborators AS collaborators
              ON collaborators.conversation_id = events.conversation_id
             AND collaborators.user_id = $1
            WHERE events.owner_id = $1
               OR collaborators.user_id = $1
            ORDER BY events.created_at DESC
            LIMIT 40
        `, [ownerId]),
    ])

    const conversations = conversationResult.rows as AiConversationRow[]
    const messages = messageResult.rows as AiMessageRow[]
    const repositories = repositoryResult.rows as {
        id: string
        owner_id: string
        name: string
        full_name: string
        branch: string
        default_branch: string
        source_path: string
        source_url: string
        auth_mode: 'public' | 'github_token' | null
        auth_hint: string | null
        sync_status: 'ready' | 'syncing' | 'error'
        last_synced_at: string | null
        last_sync_error: string | null
        sync_history: AIRepositorySyncEvent[] | null
        stack_type: AIStackType
        stack_reason: string | null
        github_token_encrypted: string | null
        github_token_hint: string | null
        github_token_attached_at: string | null
        github_token_last_used_at: string | null
        github_token_last_validated_at: string | null
        truncated: boolean
        imported_at: string
    }[]
    const files = fileResult.rows as {
        repository_id: string
        path: string
        name: string
        content: string
    }[]
    const usage = usageResult.rows as UsageRow[]

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

    const collaboratorsByConversation = new Map<string, CollaborationRow[]>()
    for (const collaborator of collaborationResult.rows as CollaborationRow[]) {
        const bucket = collaboratorsByConversation.get(collaborator.conversation_id) || []
        bucket.push(collaborator)
        collaboratorsByConversation.set(collaborator.conversation_id, bucket)
    }

    const normalizedConversations = conversations.map((conversation) =>
        toAiConversation(conversation, messagesByConversation.get(conversation.id) || [], collaboratorsByConversation.get(conversation.id) || [])
    )
    const normalizedReleases = (releaseResult.rows as ReleaseRow[]).map(toRelease)
    const normalizedDeployments = (deploymentResult.rows as DeploymentRow[]).map(toDeployment)
    const normalizedUsage = usage.map(toUsageEvent)
    const vmNames = Array.from(new Set([...normalizedDeployments.map((deployment) => deployment.vmName), ...normalizedReleases.map((release) => release.vmName)].filter(Boolean)))
    const vmOwnershipResult = vmNames.length
        ? await run(`
            SELECT name, owner, created_by
            FROM vms
            WHERE name = ANY($1::text[])
        `, [vmNames])
        : { rows: [] }
    const vmOwnership = vmOwnershipResult.rows as VmOwnershipRow[]

    return {
        conversations: normalizedConversations,
        repositories: repositories.map((repository) => ({
            id: repository.id,
            ownerId: repository.owner_id,
            accessScope: repository.owner_id === ownerId ? 'owned' : 'shared_conversation',
            name: repository.name,
            fullName: repository.full_name,
            branch: repository.branch,
            defaultBranch: repository.default_branch,
            sourcePath: repository.source_path,
            sourceUrl: repository.source_url,
            authMode: repository.auth_mode || 'public',
            authHint: repository.auth_hint,
            syncStatus: repository.sync_status || 'ready',
            lastSyncedAt: repository.last_synced_at,
            lastSyncError: repository.last_sync_error,
            syncHistory: Array.isArray(repository.sync_history) ? repository.sync_history : [],
            stackType: repository.stack_type || 'unknown',
            stackReason: repository.stack_reason,
            stackSupported: (repository.stack_type || 'unknown') !== 'unknown',
            credential: toRepoCredentialSummary({
                github_token_encrypted: repository.github_token_encrypted,
                github_token_hint: repository.github_token_hint,
                github_token_attached_at: repository.github_token_attached_at,
                github_token_last_used_at: repository.github_token_last_used_at,
                github_token_last_validated_at: repository.github_token_last_validated_at,
            }),
            truncated: repository.truncated,
            importedAt: repository.imported_at,
            files: filesByRepository.get(repository.id) || [],
        })),
        deployments: normalizedDeployments,
        releases: normalizedReleases,
        deployQuota: await getDeployQuota(ownerId),
        ownershipSummary: summarizeOwnership({
            currentUserId: ownerId,
            conversations,
            repositories,
            releases: normalizedReleases,
            deployments: normalizedDeployments,
            vmOwnership,
            collaborators: collaboratorsByConversation,
            usage: normalizedUsage,
        }),
        runtimeState: buildAiRuntimeState({
            conversations: normalizedConversations,
            clients: listGptClients('gpt'),
            participants: gpt.get('gpt')?.size || 0,
        }),
    }
}

export function toAiConversation(conversation: AiConversationRow, messages: AiMessageRow[] = [], collaborators: CollaborationRow[] = []) {
    return {
        id: conversation.id,
        ownerId: conversation.owner_id,
        title: conversation.title,
        preferredModel: conversation.preferred_model,
        activeModel: conversation.active_model,
        modelStrategy: conversation.model_strategy,
        workspaceId: conversation.workspace_id,
        workspaceKind: conversation.workspace_kind,
        shareIds: conversation.share_ids || [],
        workspaceMeta: conversation.workspace_meta || {},
        archivedAt: conversation.archived_at,
        collaboration: {
            role: conversation.access_role || 'owner',
            canInvite: (conversation.access_role || 'owner') === 'owner',
            seatLimit: 5,
            seatCount: collaborators.length,
            remainingSeats: Math.max(5 - collaborators.length, 0),
            collaborators: collaborators.map((collaborator) => ({
                userId: collaborator.user_id,
                name: collaborator.user_name,
                avatar: collaborator.user_avatar,
                role: collaborator.role,
                invitedBy: collaborator.invited_by,
                createdAt: collaborator.created_at,
            })),
        },
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

function toDeployment(row: DeploymentRow): AIDeployment {
    return {
        id: row.id,
        ownerId: row.owner_id,
        conversationId: row.conversation_id,
        repositoryId: row.repository_id,
        workspaceKind: row.workspace_kind,
        workspaceId: row.workspace_id,
        vmName: row.vm_name,
        serviceName: row.service_name,
        stackType: row.stack_type || 'unknown',
        accessPolicy: row.access_policy || 'owner_only',
        startedBy: row.started_by,
        status: row.status,
        previewUrl: buildAiPreviewUrl(row.id),
        healthcheckUrl: row.healthcheck_url,
        events: Array.isArray(row.events) ? row.events : [],
        failureReason: row.failure_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
    }
}

function toRelease(row: ReleaseRow): AIRelease {
    return {
        id: row.id,
        ownerId: row.owner_id,
        conversationId: row.conversation_id,
        deploymentId: row.deployment_id,
        vmName: row.vm_name,
        stackType: row.stack_type,
        accessPolicy: row.access_policy,
        status: row.status,
        previewUrl: row.deployment_id ? buildAiPreviewUrl(row.deployment_id) : row.preview_url,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        notes: row.notes,
    }
}

function toUsageEvent(row: UsageRow): AIUsageEvent {
    return {
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        actorId: row.actor_id,
        actorName: row.actor_name,
        conversationId: row.conversation_id,
        deploymentId: row.deployment_id,
        releaseId: row.release_id,
        kind: row.kind,
        units: Number(row.units || 1),
        metadata: row.metadata || {},
        createdAt: row.created_at,
    }
}

function summarizeOwnership({
    currentUserId,
    conversations,
    repositories,
    deployments,
    releases,
    vmOwnership,
    collaborators,
    usage,
}: {
    currentUserId: string
    conversations: AiConversationRow[]
    repositories: {
        id: string
        owner_id: string
    }[]
    deployments: AIDeployment[]
    releases: AIRelease[]
    vmOwnership: VmOwnershipRow[]
    collaborators: Map<string, CollaborationRow[]>
    usage: AIUsageEvent[]
}): AIOwnershipSummary {
    const ownerIds = new Set<string>()
    const repositoryOwnerIds = new Set<string>()
    const vmOwnerIds = new Set<string>()
    const actorIds = new Set<string>()
    let collaboratorSeatCount = 0

    for (const conversation of conversations) {
        ownerIds.add(conversation.owner_id)
        if (conversation.owner_id === currentUserId) {
            collaboratorSeatCount += collaborators.get(conversation.id)?.length || 0
        }
    }

    for (const repository of repositories) {
        repositoryOwnerIds.add(repository.owner_id)
    }

    for (const vm of vmOwnership) {
        vmOwnerIds.add(vm.owner)
    }

    let usageEventCount24h = 0
    let usageUnitCount24h = 0
    let deploymentEventCount24h = 0
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const event of usage) {
        if (event.actorId) {
            actorIds.add(event.actorId)
        }
        if (Date.parse(event.createdAt) >= cutoff) {
            usageEventCount24h += 1
            usageUnitCount24h += event.units
            if (event.kind === 'deployment_started') {
                deploymentEventCount24h += 1
            }
        }
    }

    const externalRepositoryCount = repositories.filter((repository) => repository.owner_id !== currentUserId).length
    const externalVmCount = vmOwnership.filter((vm) => vm.owner !== currentUserId).length
    const boundaryWarnings: string[] = []

    if (externalRepositoryCount > 0) {
        boundaryWarnings.push(`${externalRepositoryCount} imported repo${externalRepositoryCount === 1 ? '' : 's'} belong to another owner and are visible only through shared AI access.`)
    }

    if (externalVmCount > 0) {
        boundaryWarnings.push(`${externalVmCount} VM target${externalVmCount === 1 ? '' : 's'} run outside the current owner boundary.`)
    }

    if (ownerIds.size > 1) {
        boundaryWarnings.push('This workspace spans multiple conversation owners, so future billing and tenant policies should not assume a single owner.')
    }

    return {
        ownerIds: [...ownerIds],
        repositoryOwnerIds: [...repositoryOwnerIds],
        vmOwnerIds: [...vmOwnerIds],
        ownedConversationCount: conversations.filter((conversation) => conversation.owner_id === currentUserId).length,
        sharedConversationCount: conversations.filter((conversation) => conversation.owner_id !== currentUserId).length,
        collaboratorSeatCount,
        repositoryCount: repositories.length,
        externalRepositoryCount,
        deploymentCount: deployments.length,
        releaseCount: releases.length,
        externalVmCount,
        usageEventCount24h,
        usageUnitCount24h,
        deploymentEventCount24h,
        activeActorCount24h: actorIds.size,
        boundaryWarnings,
        recentUsage: usage.slice(0, 12),
    }
}

async function getDeployQuota(ownerId: string): Promise<AIDeployQuota> {
    const windowMinutes = 15
    const limit = 5
    const runningLimit = 2
    const result = await run(`
        SELECT COUNT(*)::int AS count
        FROM ai_deployments
        WHERE owner_id = $1
          AND created_at > NOW() - ($2::text)::interval
    `, [ownerId, `${windowMinutes} minutes`])
    const activeResult = await run(`
        SELECT COUNT(*)::int AS count
        FROM (
            SELECT DISTINCT ON (conversation_id) conversation_id, status
            FROM ai_deployments
            WHERE owner_id = $1
            ORDER BY conversation_id, updated_at DESC, created_at DESC
        ) AS latest
        WHERE status IN ('planned', 'syncing', 'building', 'healthchecking', 'running')
    `, [ownerId])
    const used = Number(result.rows[0]?.count || 0)
    const activeRunning = Number(activeResult.rows[0]?.count || 0)
    return {
        used,
        limit,
        remaining: Math.max(limit - used, 0),
        windowMinutes,
        resetsAt: new Date(Date.now() + windowMinutes * 60 * 1000).toISOString(),
        activeRunning,
        maxRunning: runningLimit,
        runningRemaining: Math.max(runningLimit - activeRunning, 0),
        sharedAcrossCollaborators: true,
    }
}
