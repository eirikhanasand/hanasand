import crypto from 'crypto'
import pg from 'pg'

const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
const dbHost = process.env.DB_HOST || '127.0.0.1'
const dbPort = Number(process.env.DB_PORT || 5432)
const dbName = process.env.DB || 'hanasand'
const dbUser = process.env.DB_USER || 'hanasand'
const dbPassword = process.env.DB_PASSWORD
const { Pool } = pg

if (!dbPassword) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const runId = `quota_smoke_${Date.now()}`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const vmName = `vm-quota-${Date.now()}`
const conversationId = `conversation-${Date.now()}`
const repositoryId = `repo-${Date.now()}`
const collaboratorIds = Array.from({ length: 6 }, (_, index) => `${runId}_collab_${index + 1}`)
const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

let token = ''

function expect(condition, message, details) {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) {
            error.details = details
        }
        throw error
    }
}

async function request(path, init = {}) {
    const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {}),
        },
    })

    const text = await response.text()
    let body
    try {
        body = text ? JSON.parse(text) : null
    } catch {
        body = text
    }

    return { response, body }
}

function authHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: runId,
        ...extra,
    }
}

async function cleanup() {
    await pool.query('DELETE FROM ai_conversation_collaborators WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_deployments WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_messages WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_conversations WHERE id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_imported_repository_files WHERE repository_id = $1', [repositoryId]).catch(() => {})
    await pool.query('DELETE FROM ai_imported_repositories WHERE id = $1', [repositoryId]).catch(() => {})
    await pool.query('DELETE FROM vm_shutdown WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vm_metrics WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vm_details WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vms WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1::text[])', [collaboratorIds]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = ANY($1::text[])', [collaboratorIds]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [collaboratorIds]).catch(() => {})
}

async function seedBase() {
    const signup = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id: runId, name: 'Quota Smoke', password }),
    })
    expect(signup.response.status === 201, 'Failed to create quota smoke user.', signup.body)

    const login = await request(`/auth/login/${runId}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(login.body?.token), 'Failed to log in quota smoke user.', login.body)
    token = login.body.token

    await pool.query(`
        INSERT INTO vms (name, owner, created_by, access_users)
        VALUES ($1, $2, $2, $3::jsonb)
    `, [vmName, runId, JSON.stringify([runId])])
    await pool.query(`
        INSERT INTO vm_details (
            name, status, type, architecture, created, last_used,
            config_architecture, config_image_architecture, config_image_description, config_image_label,
            config_image_os, config_image_release, config_image_serial, config_image_type, config_image_version,
            limits_cpu, limits_memory, volatile_base_image, volatile_cloud_init_instance_id, volatile_eth0_hwaddr,
            volatile_last_state_power, volatile_uuid, volatile_uuid_generation, volatile_vsock_id,
            device_eth0_ipv4_address, device_eth0_name, device_eth0_network, device_eth0_type,
            description, last_checked
        )
        VALUES (
            $1, 'running', 'container', 'x86_64', NOW(), NOW(),
            'x86_64', 'x86_64', 'Ubuntu quota VM', 'ubuntu-25.10',
            'ubuntu', '25.10', '20260425', 'squashfs', '25.10',
            '2', '2GiB', 'base-image', 'cloud-init-quota', '00:16:3e:00:00:02',
            'RUNNING', 'uuid-quota', 'uuid-generation-quota', '1002',
            '10.55.0.10', 'eth0', 'lxdbr0', 'nic',
            'Quota VM target', NOW()
        )
    `, [vmName])
    await pool.query(`
        INSERT INTO ai_imported_repositories (
            id, owner_id, name, full_name, branch, default_branch, source_path, source_url,
            auth_mode, sync_status, stack_type, stack_reason, imported_at
        )
        VALUES (
            $1, $2, 'quota-smoke', 'example/quota-smoke', 'main', 'main', '', 'https://github.com/example/quota-smoke',
            'public', 'ready', 'nextjs_docker', 'Pre-seeded supported stack for quota smoke.', NOW()
        )
    `, [repositoryId, runId])
    await pool.query(`
        INSERT INTO ai_conversations (
            id, owner_id, title, workspace_kind, workspace_id, workspace_meta, created_at, updated_at
        )
        VALUES ($1, $2, 'Quota smoke', 'repo', $3, $4::jsonb, NOW(), NOW())
    `, [conversationId, runId, repositoryId, JSON.stringify({ repositoryId })])

    for (const collaboratorId of collaboratorIds) {
        await request('/user', {
            method: 'POST',
            body: JSON.stringify({ id: collaboratorId, name: collaboratorId, password }),
        })
    }
}

async function main() {
    await cleanup()
    await seedBase()

    await pool.query(`
        INSERT INTO ai_deployments (
            id, owner_id, conversation_id, repository_id, workspace_kind, workspace_id, vm_name, service_name,
            stack_type, access_policy, started_by, status, preview_url, healthcheck_url, events, failure_reason, completed_at
        )
        VALUES
        (
            $1, $2, $3, $4, 'repo', $4, $5, 'quota-app-a',
            'nextjs_docker', 'owner_only', $2, 'running', 'http://preview-a', 'http://127.0.0.1:3000/',
            '[]'::jsonb, NULL, NOW()
        ),
        (
            $6, $2, $3, $4, 'repo', $4, $5, 'quota-app-b',
            'nextjs_docker', 'owner_only', $2, 'healthchecking', 'http://preview-b', 'http://127.0.0.1:3001/',
            '[]'::jsonb, NULL, NOW()
        )
    `, [
        `deploy_running_${Date.now()}`,
        runId,
        conversationId,
        repositoryId,
        vmName,
        `deploy_checking_${Date.now()}`,
    ])

    const quota = await request('/ai/deployments', {
        headers: authHeaders(),
    })
    expect(quota.response.status === 200, 'Failed to fetch deployment quota.', quota.body)
    expect(quota.body?.quota?.activeRunning === 2, 'Active running deploy count did not match seeded data.', quota.body)
    expect(quota.body?.quota?.runningRemaining === 0, 'Running remaining count should be zero.', quota.body)
    expect(quota.body?.quota?.sharedAcrossCollaborators === true, 'Quota should be marked shared across collaborators.', quota.body)

    const blocked = await request('/ai/deployments', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            conversationId,
            vmName,
            port: 3000,
            healthPath: '/',
        }),
    })
    expect(blocked.response.status === 429, 'Concurrent live deploy limit should reject the request.', blocked.body)
    expect(typeof blocked.body?.error === 'string' && blocked.body.error.includes('Live deploy limit reached'), 'Blocked deploy should explain the live deploy limit.', blocked.body)
    expect(blocked.body?.quota?.activeRunning === 2, 'Blocked deploy response should include active running count.', blocked.body)

    for (const collaboratorId of collaboratorIds.slice(0, 5)) {
        const invite = await request(`/ai/conversations/${conversationId}/collaborators`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ userId: collaboratorId, role: 'editor' }),
        })
        expect(invite.response.status === 201, 'Collaborator under the seat limit should be accepted.', invite.body)
    }

    const overSeatLimit = await request(`/ai/conversations/${conversationId}/collaborators`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId: collaboratorIds[5], role: 'reviewer' }),
    })
    expect(overSeatLimit.response.status === 429, 'Collaborator seat quota should reject the sixth invite.', overSeatLimit.body)
    expect(typeof overSeatLimit.body?.error === 'string' && overSeatLimit.body.error.includes('collaborator limit reached'), 'Seat quota error should explain the collaborator limit.', overSeatLimit.body)
    expect(overSeatLimit.body?.quota?.limit === 5, 'Seat quota response should expose the seat limit.', overSeatLimit.body)

    console.log(JSON.stringify({
        ok: true,
        activeRunning: quota.body.quota.activeRunning,
        maxRunning: quota.body.quota.maxRunning,
        runningRemaining: quota.body.quota.runningRemaining,
        blockedError: blocked.body.error,
        collaboratorSeatLimit: overSeatLimit.body?.quota?.limit,
    }, null, 2))
}

main()
    .catch((error) => {
        console.error(error.details ?? error)
        process.exitCode = 1
    })
    .finally(async () => {
        await cleanup()
        await pool.end()
    })
