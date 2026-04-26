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

const runId = `vm_smoke_${Date.now()}`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const vmName = `vm-${runId}`
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
        body: JSON.stringify({ id: runId, name: 'VM Smoke', password }),
    })
    expect(signup.response.status === 201, 'Failed to create smoke user.', signup.body)

    await pool.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by)
        SELECT $1, role_id, 'administrator'
        FROM unnest($2::text[]) AS role_id
        ON CONFLICT DO NOTHING
    `, [runId, ['users', 'user_admin', 'system_admin']])

    const login = await request(`/auth/login/${runId}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(login.body?.token), 'Failed to log in smoke user.', login.body)
    token = login.body.token

    const createVm = await request('/vm', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            name: vmName,
            owner: runId,
            created_by: runId,
            access_users: [runId],
        }),
    })
    expect(createVm.response.status === 201, 'Failed to create smoke VM.', createVm.body)

    const executionTargets = await request('/tools/execution-targets', {
        headers: authHeaders(),
    })
    expect(executionTargets.response.status === 200, 'Execution targets endpoint failed.', executionTargets.body)
    expect(Array.isArray(executionTargets.body?.targets), 'Execution targets response is missing targets[].', executionTargets.body)

    const vmExecutionTarget = executionTargets.body.targets.find((target) => target?.id === `vm:${vmName}`)
    expect(vmExecutionTarget, 'Execution targets did not include the smoke VM.', executionTargets.body)
    expect(vmExecutionTarget.kind === 'vm', 'Execution target kind was not vm.', vmExecutionTarget)
    expect(vmExecutionTarget.transport === 'hanasand_vm_api', 'Execution target transport was unexpected.', vmExecutionTarget)
    expect(vmExecutionTarget.target?.capabilities?.canExecuteRemoteCommands === false, 'VM target should still advertise remote exec as unavailable.', vmExecutionTarget)

    const targets = await request('/vms/agent/targets', {
        headers: authHeaders(),
    })
    expect(targets.response.status === 200, 'Agent targets endpoint failed.', targets.body)
    expect(Array.isArray(targets.body?.targets), 'Agent targets response is missing targets[].', targets.body)
    expect(Array.isArray(targets.body?.missingPlatformCapabilities), 'Agent targets response is missing platform capability notes.', targets.body)

    const listedTarget = targets.body.targets.find((target) => target?.id === vmName)
    expect(listedTarget, 'Agent targets list did not include the smoke VM.', targets.body)
    expect(listedTarget.endpoints?.connection === `/api/vm/${encodeURIComponent(vmName)}/connection`, 'Agent target connection endpoint was unexpected.', listedTarget)
    expect(listedTarget.capabilities?.supportedConnectionMethods?.includes('ssh'), 'Agent target should expose ssh as the supported connection method.', listedTarget)
    expect(Array.isArray(listedTarget.capabilities?.missingCapabilities), 'Agent target is missing capability guidance.', listedTarget)

    const singleTarget = await request(`/vm/${vmName}/agent-target`, {
        headers: authHeaders(),
    })
    expect(singleTarget.response.status === 200, 'Single agent target endpoint failed.', singleTarget.body)
    expect(singleTarget.body?.id === vmName, 'Single target response returned the wrong VM id.', singleTarget.body)
    expect(singleTarget.body?.suggestedFlow?.selection === 'vm', 'Single target response did not mark the VM as selectable.', singleTarget.body)
    expect(typeof singleTarget.body?.suggestedFlow?.connect === 'string', 'Single target response is missing the ssh connect hint.', singleTarget.body)
    expect(singleTarget.body?.endpoints?.syncAuthorizedKeys === `/api/vm/${encodeURIComponent(vmName)}/agent-target/sync-access`, 'Single target response is missing the sync-access endpoint.', singleTarget.body)

    const syncAccess = await request(`/vm/${vmName}/agent-target/sync-access`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ scope: 'current_user' }),
    })
    expect(syncAccess.response.status === 200, 'Sync-access endpoint failed.', syncAccess.body)
    expect(syncAccess.body?.ok === true, 'Sync-access response did not report success.', syncAccess.body)
    expect(syncAccess.body?.vmName === vmName, 'Sync-access response returned the wrong VM id.', syncAccess.body)
    expect(syncAccess.body?.scope === 'current_user', 'Sync-access response returned the wrong scope.', syncAccess.body)
    expect(Array.isArray(syncAccess.body?.syncedUserIds), 'Sync-access response is missing synced user ids.', syncAccess.body)
    expect(syncAccess.body?.syncedUserIds?.includes(runId), 'Sync-access response did not include the authenticated user.', syncAccess.body)

    console.log(JSON.stringify({
        ok: true,
        vmName,
        executionTargetId: vmExecutionTarget.id,
        supportedActions: singleTarget.body.capabilities.supportedActions,
        connectionHint: singleTarget.body.suggestedFlow.connect,
        syncEndpoint: singleTarget.body.endpoints.syncAuthorizedKeys,
        syncCertificateCount: syncAccess.body.certificateCount,
        missingCapabilities: singleTarget.body.capabilities.missingCapabilities.map((item) => item.key),
    }, null, 2))
}

main()
    .catch(error => {
        console.error(error.details ?? error)
        process.exitCode = 1
    })
    .finally(async () => {
        await cleanup()
        await pool.end()
    })
