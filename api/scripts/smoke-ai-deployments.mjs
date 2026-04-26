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

const runId = `deploy_smoke_${Date.now()}`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const vmName = `vm-deploy-${Date.now()}`
const conversationId = `conversation-${Date.now()}`
const repositoryId = `repo-${Date.now()}`
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

function authHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: runId,
        ...extra,
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

async function cleanup() {
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
}

async function main() {
    await cleanup()

    const signup = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id: runId, name: 'Deploy Smoke', password }),
    })
    expect(signup.response.status === 201, 'Failed to create smoke user.', signup.body)

    const login = await request(`/auth/login/${runId}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(login.body?.token), 'Failed to log in smoke user.', login.body)
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
            $1, 'running', 'container', 'x86_64', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z',
            'x86_64', 'x86_64', 'Ubuntu smoke VM', 'ubuntu-25.10',
            'ubuntu', '25.10', '20260425', 'squashfs', '25.10',
            '2', '2GiB', 'base-image', 'cloud-init-smoke', '00:16:3e:00:00:01',
            'RUNNING', 'uuid-smoke', 'uuid-generation-smoke', '1001',
            '10.55.0.9', 'eth0', 'lxdbr0', 'nic',
            'Smoke VM target', NOW()
        )
    `, [vmName])
    await pool.query(`
        INSERT INTO ai_imported_repositories (
            id, owner_id, name, full_name, branch, default_branch, source_path, source_url, auth_mode, sync_status, imported_at
        )
        VALUES ($1, $2, 'deploy-smoke', 'example/deploy-smoke', 'main', 'main', 'apps/web', 'https://github.com/example/deploy-smoke/tree/main/apps/web', 'public', 'ready', NOW())
    `, [repositoryId, runId])
    await pool.query(`
        INSERT INTO ai_conversations (
            id, owner_id, title, workspace_kind, workspace_id, workspace_meta, created_at, updated_at
        )
        VALUES ($1, $2, 'Deploy smoke', 'repo', $3, $4::jsonb, NOW(), NOW())
    `, [conversationId, runId, repositoryId, JSON.stringify({ repositoryId })])

    const deploy = await request('/ai/deployments', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            conversationId,
            vmName,
            port: 3000,
            healthPath: '/',
        }),
    })
    expect(deploy.response.status === 202, 'Blocked deploy smoke should return 202.', deploy.body)
    expect(deploy.body?.deployment?.status === 'blocked', 'Deploy smoke should record a blocked deployment.', deploy.body)
    expect(typeof deploy.body?.deployment?.failureReason === 'string' && deploy.body.deployment.failureReason.includes('Repo subpath deployments are not supported yet'), 'Deploy smoke should surface the explicit subpath failure.', deploy.body)
    expect(Array.isArray(deploy.body?.deployment?.events), 'Deploy smoke should return deploy events.', deploy.body)
    expect(deploy.body.deployment.events.some((event) => event.stage === 'blocked'), 'Deploy smoke should include a blocked event.', deploy.body)

    const workspace = await request('/ai/workspace', {
        headers: authHeaders(),
    })
    expect(workspace.response.status === 200, 'Workspace bundle should load after deploy smoke.', workspace.body)
    expect(Array.isArray(workspace.body?.deployments), 'Workspace bundle should expose deployments.', workspace.body)
    expect(workspace.body.deployments.some((deployment) => deployment.id === deploy.body.deployment.id), 'Workspace bundle should include the recorded deployment.', workspace.body)

    console.log(JSON.stringify({
        ok: true,
        deploymentId: deploy.body.deployment.id,
        status: deploy.body.deployment.status,
        failureReason: deploy.body.deployment.failureReason,
        eventCount: deploy.body.deployment.events.length,
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
