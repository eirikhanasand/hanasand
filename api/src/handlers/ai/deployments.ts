import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'
import hasRole from '#utils/auth/hasRole.ts'
import { agentTargetSelect } from '#utils/vms/agentTargetQuery.ts'
import { getRepoCredential } from '#utils/ai/repoCredentials.ts'
import { getConversationForUser, requireAiUser } from './shared.ts'
import { detectRepositoryStack } from '#utils/ai/stack.ts'
import { inferDeployDefaults } from '#utils/ai/deploy.ts'
import { recordAiUsageEvent } from '#utils/ai/usage.ts'
import { buildAiPreviewUrl } from '#utils/ai/preview.ts'

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

type VMRow = {
    name: string
    owner: string
    created_by: string
    access_users: string[] | null
    device_eth0_ipv4_address: string
}

type RepositoryRow = {
    id: string
    owner_id: string
    name: string
    full_name: string
    branch: string
    source_path: string
    stack_type: AIStackType
    stack_reason: string | null
    files: AIImportedRepoFile[]
}

type StartDeploymentBody = {
    conversationId?: string
    vmName?: string
    port?: number | string
    healthPath?: string
    accessPolicy?: AIDeploymentAccessPolicy
    environment?: 'staging' | 'production'
}

const DEPLOY_WINDOW_MINUTES = 15
const DEPLOY_WINDOW_LIMIT = 5
const DEPLOY_RUNNING_LIMIT = 2
const DEPLOY_RETRY_ATTEMPTS = 3
const DEPLOY_RETRY_BASE_DELAY_MS = 500

export async function getAiDeployments(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { conversationId } = req.query as { conversationId?: string }
    const params = conversationId ? [userId, conversationId] : [userId]
    const result = await run(`
        SELECT ai_deployments.*
        FROM ai_deployments
        JOIN ai_conversations
          ON ai_conversations.id = ai_deployments.conversation_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_deployments.conversation_id
         AND collaborators.user_id = $1
        WHERE (
            ai_deployments.owner_id = $1
            OR collaborators.user_id = $1
        )
        ${conversationId ? 'AND ai_deployments.conversation_id = $2' : ''}
        ORDER BY ai_deployments.updated_at DESC, ai_deployments.created_at DESC
        LIMIT 25
    `, params)

    return res.send({
        deployments: (result.rows as DeploymentRow[]).map(toDeployment),
        quota: await getDeployQuota(userId),
    })
}

export async function postAiDeployment(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const body = (req.body as StartDeploymentBody | undefined) ?? {}
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
    const vmName = typeof body.vmName === 'string' ? body.vmName.trim() : ''
    const accessPolicy = normalizeAccessPolicy(body.accessPolicy)
    const environment = normalizeEnvironment(body.environment)

    if (!conversationId) {
        return res.status(400).send({ error: 'Missing conversationId.' })
    }

    if (!vmName) {
        return res.status(400).send({ error: 'Missing vmName.' })
    }

    const conversation = await getConversationForUser(conversationId, userId)
    if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    const repository = await getConversationRepository(conversation, userId)
    if (!repository) {
        return res.status(400).send({ error: 'Attach an imported repository before deploying from AI.' })
    }

    const quota = await getDeployQuota(userId)
    if (quota.remaining <= 0) {
        return res.status(429).send({
            error: `Deploy limit reached. Try again after ${quota.resetsAt}.`,
            quota,
        })
    }
    if (quota.runningRemaining <= 0) {
        return res.status(429).send({
            error: `Live deploy limit reached. This owner already has ${quota.activeRunning}/${quota.maxRunning} active deployments. Wait for one to finish or roll back before starting another.`,
            quota,
        })
    }

    const vm = await getAccessibleVm(req, res, vmName, userId)
    if (!vm) {
        return
    }

    const detectedStack = repository.stack_type && repository.stack_type !== 'unknown'
        ? { stackType: repository.stack_type, reason: repository.stack_reason }
        : detectRepositoryStack(repository.files)
    const now = new Date().toISOString()
    const deployDefaults = inferDeployDefaults(detectedStack.stackType, {
        port: body.port,
        healthPath: body.healthPath,
    })
    const port = deployDefaults.port
    const healthPath = deployDefaults.healthPath
    const healthcheckUrl = `http://127.0.0.1:${port}${healthPath}`
    const previewUrl = vm.device_eth0_ipv4_address ? `http://${vm.device_eth0_ipv4_address}:${port}${healthPath}` : null
    const id = `deploy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const serviceName = normalizeServiceName(repository.name || repository.full_name || conversation.title || vm.name)
    const envPlaceholders = collectEnvPlaceholders(repository.files)
    const ownedProfile = buildOwnedDeploymentProfile({
        serviceName,
        environment,
        accessPolicy,
        vmName: vm.name,
        port,
        healthPath,
        envPlaceholders,
    })
    const events: AIDeploymentEvent[] = [
        deploymentEvent('planned', 'Deployment orchestrator accepted the repository-backed workspace and VM target.', now),
        deploymentEvent('sync_access', 'Using the privileged VM deploy bridge, so SSH key sync is not required for this path.', now),
        deploymentEvent('planned', detectedStack.stackType === 'unknown' ? 'Stack not confidently recognized. This deployment will stay blocked until the repository matches a supported contract.' : `Detected supported stack: ${detectedStack.stackType}.`, now),
        deploymentEvent('planned', ownedProfile.summary, now),
        ...ownedProfile.checklist.map((item) => deploymentEvent('planned', item, now)),
    ]
    if (deployDefaults.inferred) {
        events.push(deploymentEvent('planned', deployDefaults.reason, now))
    }

    let status: AIDeploymentStatus = 'blocked'
    let failureReason: string | null
    let completedAt: string | null

    if (detectedStack.stackType === 'unknown') {
        completedAt = new Date().toISOString()
        failureReason = explainDeploymentFailure('unsupported_stack', detectedStack.reason)
        events.push(deploymentEvent('blocked', failureReason, completedAt))
    } else if (repository.source_path) {
        completedAt = new Date().toISOString()
        failureReason = explainDeploymentFailure('repo_subpath', repository.source_path)
        events.push(deploymentEvent('blocked', `This repository is attached from the subpath "${repository.source_path}". The current deploy orchestrator only supports repo-root Docker Compose projects.`, completedAt))
    } else {
        try {
            const repoCredential = await getRepoCredential(repository.id, userId).catch(() => null)
            events.push(deploymentEvent('sync', `Preparing ${repository.full_name} on branch ${repository.branch}.`, new Date().toISOString()))

            const deployAttempt = await fetchJsonWithDeployRetry(`${config.internal_api}/vm/${encodeURIComponent(vm.name)}/deploy`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'hanasand_api',
                },
                body: JSON.stringify({
                    repoUrl: `https://github.com/${repository.full_name}.git`,
                    branch: repository.branch,
                    serviceName,
                    githubToken: repoCredential?.token || '',
                }),
            }, events, 'remote deploy bridge')
            const deployResponse = deployAttempt.response
            const deployPayload = deployAttempt.payload as {
                ok?: boolean
                events?: Array<{ stage?: string; message?: string; timestamp?: string }>
                failureReason?: string
            } | null

            for (const event of Array.isArray(deployPayload?.events) ? deployPayload.events : []) {
                if (typeof event?.stage === 'string' && typeof event?.message === 'string') {
                    events.push(deploymentEvent(normalizeStage(event.stage), event.message, typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString()))
                }
            }

            if (!deployResponse.ok || !deployPayload?.ok) {
                status = 'blocked'
                failureReason = explainDeploymentFailure('bridge_failed', deployPayload?.failureReason || `Remote deploy bridge returned HTTP ${deployResponse.status}.`)
                completedAt = new Date().toISOString()
                events.push(deploymentEvent('blocked', failureReason, completedAt))
            } else {
                status = 'healthchecking'
                events.push(deploymentEvent('healthcheck', `Running VM-local healthcheck on ${healthcheckUrl}.`, new Date().toISOString()))

                const healthAttempt = await fetchTextWithDeployRetry(`${config.internal_api}/vm/${encodeURIComponent(vm.name)}/request`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'hanasand_api',
                    },
                    body: JSON.stringify({
                        method: 'GET',
                        url: healthcheckUrl,
                        headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
                        body: '',
                    }),
                }, events, 'VM-local healthcheck')
                const healthResponse = healthAttempt.response
                const healthText = healthAttempt.text
                const eventTime = new Date().toISOString()

                if (healthResponse.ok) {
                    status = 'running'
                    failureReason = null
                    events.push(deploymentEvent('healthcheck', `Healthcheck passed with HTTP ${healthResponse.status}.`, eventTime))
                } else {
                    status = 'blocked'
                    failureReason = explainDeploymentFailure('healthcheck_failed', `The service did not answer successfully at ${port}${healthPath}.`)
                    events.push(deploymentEvent('healthcheck_failed', `Healthcheck returned HTTP ${healthResponse.status}: ${healthText.slice(0, 280)}`, eventTime))
                    events.push(deploymentEvent('blocked', failureReason, eventTime))
                }

                completedAt = new Date().toISOString()
            }
        } catch (error) {
            status = 'blocked'
            failureReason = explainDeploymentFailure('unexpected', error instanceof Error ? error.message : 'Unable to reach the VM deploy bridge.')
            completedAt = new Date().toISOString()
            events.push(deploymentEvent('blocked', failureReason, completedAt))
        }
    }

    const result = await run(`
        INSERT INTO ai_deployments (
            id, owner_id, conversation_id, repository_id, workspace_kind, workspace_id, vm_name, service_name,
            stack_type, access_policy, started_by, status, preview_url, healthcheck_url, events, failure_reason, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17)
        RETURNING *
    `, [
        id,
        userId,
        conversation.id,
        repository.id,
        conversation.workspace_kind,
        conversation.workspace_id,
        vm.name,
        serviceName,
        detectedStack.stackType,
        accessPolicy,
        userId,
        status,
        previewUrl,
        healthcheckUrl,
        JSON.stringify(events),
        failureReason,
        completedAt ?? null,
    ])

    const deployment = (result.rows as DeploymentRow[])[0]
    await recordAiUsageEvent({
        ownerId: conversation.owner_id,
        actorId: userId,
        conversationId: conversation.id,
        repositoryId: repository.id,
        deploymentId: deployment.id,
        workspaceKind: conversation.workspace_kind,
        workspaceId: conversation.workspace_id,
        kind: 'deployment_started',
        metadata: {
            vmName: vm.name,
            status,
            accessPolicy,
            stackType: detectedStack.stackType,
            environment,
            domain: ownedProfile.domain,
            envPlaceholders,
            collaborative: conversation.owner_id !== userId,
        },
    })
    await recordRelease({
        deployment,
        ownerId: conversation.owner_id,
        status: status === 'running' ? 'current' : 'failed',
        previewUrl,
        createdBy: userId,
        notes: failureReason,
    })

    return res.status(status === 'running' ? 201 : 202).send({ deployment: toDeployment(deployment), quota: await getDeployQuota(userId) })
}

async function getDeployQuota(ownerId: string) {
    const result = await run(`
        SELECT COUNT(*)::int AS count
        FROM ai_deployments
        WHERE owner_id = $1
          AND created_at > NOW() - ($2::text)::interval
    `, [ownerId, `${DEPLOY_WINDOW_MINUTES} minutes`])
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
    const remaining = Math.max(DEPLOY_WINDOW_LIMIT - used, 0)
    const runningRemaining = Math.max(DEPLOY_RUNNING_LIMIT - activeRunning, 0)
    const resetsAt = new Date(Date.now() + DEPLOY_WINDOW_MINUTES * 60 * 1000).toISOString()
    return {
        used,
        limit: DEPLOY_WINDOW_LIMIT,
        remaining,
        windowMinutes: DEPLOY_WINDOW_MINUTES,
        resetsAt,
        activeRunning,
        maxRunning: DEPLOY_RUNNING_LIMIT,
        runningRemaining,
        sharedAcrossCollaborators: true,
    }
}

async function recordRelease({
    deployment,
    ownerId,
    status,
    previewUrl,
    createdBy,
    notes,
}: {
    deployment: DeploymentRow
    ownerId: string
    status: 'current' | 'failed'
    previewUrl: string | null
    createdBy: string
    notes: string | null
}) {
    if (status === 'current') {
        await run(`
            UPDATE ai_releases
            SET status = 'superseded', updated_at = NOW()
            WHERE conversation_id = $1
              AND status = 'current'
        `, [deployment.conversation_id])
    }

    const releaseId = `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    await run(`
        INSERT INTO ai_releases (
            id, owner_id, conversation_id, deployment_id, vm_name,
            stack_type, access_policy, status, preview_url, created_by, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
        releaseId,
        ownerId,
        deployment.conversation_id,
        deployment.id,
        deployment.vm_name,
        deployment.stack_type || 'unknown',
        deployment.access_policy || 'owner_only',
        status,
        previewUrl,
        createdBy,
        notes,
    ])

    await recordAiUsageEvent({
        ownerId,
        actorId: createdBy,
        conversationId: deployment.conversation_id,
        repositoryId: deployment.repository_id,
        deploymentId: deployment.id,
        releaseId,
        workspaceKind: deployment.workspace_kind,
        workspaceId: deployment.workspace_id,
        kind: 'release_recorded',
        metadata: {
            status,
            vmName: deployment.vm_name,
            stackType: deployment.stack_type || 'unknown',
            accessPolicy: deployment.access_policy || 'owner_only',
        },
    })
}

async function fetchJsonWithDeployRetry(url: string, init: RequestInit, events: AIDeploymentEvent[], label: string) {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= DEPLOY_RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(url, init)
            const payload = await response.json().catch(() => null)
            if (!shouldRetryResponse(response, attempt)) {
                return { response, payload }
            }

            events.push(deploymentEvent('sync', retryMessage(label, `HTTP ${response.status}`, attempt), new Date().toISOString()))
        } catch (error) {
            lastError = error
            if (attempt >= DEPLOY_RETRY_ATTEMPTS) {
                throw error
            }

            events.push(deploymentEvent('sync', retryMessage(label, error instanceof Error ? error.message : 'request failed', attempt), new Date().toISOString()))
        }

        await delayDeployRetry(attempt)
    }

    throw lastError instanceof Error ? lastError : new Error(`Unable to reach ${label}.`)
}

async function fetchTextWithDeployRetry(url: string, init: RequestInit, events: AIDeploymentEvent[], label: string) {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= DEPLOY_RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(url, init)
            const text = await response.text()
            if (!shouldRetryResponse(response, attempt)) {
                return { response, text }
            }

            events.push(deploymentEvent('healthcheck', retryMessage(label, `HTTP ${response.status}`, attempt), new Date().toISOString()))
        } catch (error) {
            lastError = error
            if (attempt >= DEPLOY_RETRY_ATTEMPTS) {
                throw error
            }

            events.push(deploymentEvent('healthcheck', retryMessage(label, error instanceof Error ? error.message : 'request failed', attempt), new Date().toISOString()))
        }

        await delayDeployRetry(attempt)
    }

    throw lastError instanceof Error ? lastError : new Error(`Unable to reach ${label}.`)
}

function shouldRetryResponse(response: Response, attempt: number) {
    return attempt < DEPLOY_RETRY_ATTEMPTS && (response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500)
}

function retryMessage(label: string, reason: string, attempt: number) {
    return `Retrying ${label} after ${reason} (attempt ${attempt + 1}/${DEPLOY_RETRY_ATTEMPTS}).`
}

async function delayDeployRetry(attempt: number) {
    await new Promise((resolve) => setTimeout(resolve, DEPLOY_RETRY_BASE_DELAY_MS * attempt))
}

async function getAccessibleVm(req: FastifyRequest, res: FastifyReply, vmName: string, userId: string) {
    const { valid: isAdmin } = await hasRole(req, res, 'system_admin')
    const result = await run(`
        ${agentTargetSelect}
        WHERE v.name = $1
        LIMIT 1
    `, [vmName])

    if (!result.rows.length) {
        res.status(404).send({ error: 'VM not found.' })
        return null
    }

    const vm = result.rows[0] as VMRow
    const accessUsers = Array.isArray(vm.access_users) ? vm.access_users : []
    const canAccess = isAdmin || vm.owner === userId || vm.created_by === userId || accessUsers.includes(userId)
    if (!canAccess) {
        res.status(403).send({ error: 'Forbidden.' })
        return null
    }

    return vm
}

async function getConversationRepository(conversation: Awaited<ReturnType<typeof getConversationForUser>>, ownerId: string) {
    const repositoryId = typeof conversation?.workspace_meta?.repositoryId === 'string'
        ? conversation.workspace_meta.repositoryId
        : conversation?.workspace_kind === 'repo'
            ? conversation.workspace_id
            : null

    if (!repositoryId) {
        return null
    }

    const result = await run(`
        SELECT repositories.id, repositories.owner_id, repositories.name, repositories.full_name, repositories.branch,
               repositories.source_path, repositories.stack_type, repositories.stack_reason,
               COALESCE(
                   JSON_AGG(JSON_BUILD_OBJECT('path', files.path, 'name', files.name, 'content', files.content))
                   FILTER (WHERE files.path IS NOT NULL),
                   '[]'::json
               ) AS files
        FROM ai_imported_repositories AS repositories
        LEFT JOIN ai_imported_repository_files AS files
          ON files.repository_id = repositories.id
        WHERE repositories.id = $1
          AND repositories.owner_id = $2
        GROUP BY repositories.id
        LIMIT 1
    `, [repositoryId, ownerId])

    return (result.rows[0] as RepositoryRow | undefined) || null
}

function normalizeAccessPolicy(value: StartDeploymentBody['accessPolicy']): AIDeploymentAccessPolicy {
    return value === 'collaborators' || value === 'public_preview' ? value : 'owner_only'
}

function normalizeEnvironment(value: StartDeploymentBody['environment']) {
    return value === 'production' ? 'production' : 'staging'
}

function normalizeServiceName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'workspace'
}

function collectEnvPlaceholders(files: AIImportedRepoFile[]) {
    const names = new Set<string>()
    for (const file of files) {
        const path = file.path.toLowerCase()
        const content = file.content || ''
        if (path.endsWith('.env.example') || path.endsWith('.env.template') || path === '.env.example') {
            for (const line of content.split('\n')) {
                const match = line.match(/^\s*([A-Z][A-Z0-9_]{1,80})\s*=/)
                if (match) {
                    names.add(match[1])
                }
            }
        }

        for (const match of content.matchAll(/\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]{1,80})\b/g)) {
            names.add(match[1])
        }
    }

    return Array.from(names)
        .filter((name) => !['NODE_ENV', 'PORT', 'HOST', 'HOSTNAME'].includes(name))
        .sort()
}

function buildOwnedDeploymentProfile({
    serviceName,
    environment,
    accessPolicy,
    vmName,
    port,
    healthPath,
    envPlaceholders,
}: {
    serviceName: string
    environment: 'staging' | 'production'
    accessPolicy: AIDeploymentAccessPolicy
    vmName: string
    port: number
    healthPath: string
    envPlaceholders: string[]
}) {
    const domain = environment === 'production'
        ? `${serviceName}.hanasand.com`
        : `${serviceName}.staging.hanasand.com`
    return {
        domain,
        summary: `Owned ${environment} deployment profile: domain ${domain}, automatic SSL after routing, VM ${vmName}, access ${accessPolicy.replaceAll('_', ' ')}.`,
        checklist: [
            `Deploy checklist: domain route ${domain} will be owned by Hanasand infrastructure.`,
            'Deploy checklist: SSL is expected after the domain route responds; certificate contents are never printed.',
            `Deploy checklist: health check will run after launch at ${port}${healthPath}.`,
            envPlaceholders.length
                ? `Deploy checklist: ${envPlaceholders.length} environment placeholder${envPlaceholders.length === 1 ? '' : 's'} detected (${envPlaceholders.join(', ')}); values are never echoed.`
                : 'Deploy checklist: no required environment placeholders were detected from imported files.',
            'Deploy checklist: build logs, VM bridge events, health result, and release record are persisted for refresh and reporting.',
            'Deploy checklist: previous releases remain selectable as rollback targets before production cutover.',
        ],
    }
}

function explainDeploymentFailure(kind: 'unsupported_stack' | 'repo_subpath' | 'bridge_failed' | 'healthcheck_failed' | 'unexpected', detail?: string | null) {
    switch (kind) {
        case 'unsupported_stack':
            return `This project is not deployable yet because Hanasand could not find a supported Docker deployment shape. Add a Dockerfile and docker-compose.yml at the repo root, then try again. ${detail || ''}`.trim()
        case 'repo_subpath':
            return `This project was imported from a subfolder, so the deploy runner cannot safely own the full release yet. Re-import the repository from its root, then deploy again. Subfolder: ${detail || 'unknown'}.`
        case 'bridge_failed':
            return `The server could not complete the VM deployment step. No production traffic was moved. The next check is the deploy log for the VM bridge. ${detail || ''}`.trim()
        case 'healthcheck_failed':
            return `The build finished, but the launched app did not pass its health check. Visitors were not promoted to this release. Check that the app listens on the selected port/path, then retry. ${detail || ''}`.trim()
        case 'unexpected':
            return `The deploy could not be completed because the deployment service returned an unexpected error. No secret values were printed and no release was promoted. ${detail || ''}`.trim()
    }
}

function normalizeStage(stage: string): AIDeploymentStage {
    switch (stage) {
        case 'clone':
            return 'clone'
        case 'sync':
        case 'fetch':
        case 'checkout':
        case 'pull':
            return 'sync'
        case 'build':
            return 'build'
        case 'run':
        case 'running':
            return 'run'
        case 'healthcheck':
            return 'healthcheck'
        case 'healthcheck_failed':
            return 'healthcheck_failed'
        case 'auth':
            return 'sync_access'
        case 'blocked':
        case 'compose_missing':
            return 'blocked'
        default:
            return 'planned'
    }
}

function deploymentEvent(stage: AIDeploymentStage, message: string, timestamp: string): AIDeploymentEvent {
    return { stage, message, timestamp }
}

export function toDeployment(row: DeploymentRow): AIDeployment {
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
