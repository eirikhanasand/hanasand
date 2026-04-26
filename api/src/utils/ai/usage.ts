import run from '#db'

type RecordAiUsageEventInput = {
    ownerId: string
    actorId: string | null
    conversationId: string | null
    repositoryId?: string | null
    deploymentId?: string | null
    releaseId?: string | null
    workspaceKind?: 'share' | 'repo' | null
    workspaceId?: string | null
    kind: AIUsageEventKind
    units?: number
    metadata?: Record<string, unknown>
}

export async function recordAiUsageEvent({
    ownerId,
    actorId,
    conversationId,
    repositoryId = null,
    deploymentId = null,
    releaseId = null,
    workspaceKind = null,
    workspaceId = null,
    kind,
    units = 1,
    metadata = {},
}: RecordAiUsageEventInput) {
    await run(`
        INSERT INTO ai_usage_events (
            owner_id, actor_id, conversation_id, repository_id, deployment_id, release_id,
            workspace_kind, workspace_id, kind, units, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    `, [
        ownerId,
        actorId,
        conversationId,
        repositoryId,
        deploymentId,
        releaseId,
        workspaceKind,
        workspaceId,
        kind,
        Math.max(1, Math.trunc(units) || 1),
        JSON.stringify(metadata),
    ])
}
