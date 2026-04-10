import pg from 'pg'

const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
const dbHost = process.env.DB_HOST || '127.0.0.1'
const dbPort = Number(process.env.DB_PORT || 5432)
const dbName = process.env.DB || 'hanasand'
const dbUser = process.env.DB_USER || 'hanasand'
const dbPassword = process.env.DB_PASSWORD || 'ultrastronghphanasandpassword'
const vmToken = process.env.VM_API_TOKEN || ''
const runId = `audit_${Date.now()}`
const password = 'Aa11!!Aa11!!Bb22'
const { Pool } = pg
const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

const results = []
let token = ''

function expectObject(body) {
    return body && typeof body === 'object' && !Array.isArray(body)
}

function expectArray(body) {
    return Array.isArray(body)
}

function expectAny() {
    return true
}

function authHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: runId,
        ...extra,
    }
}

function vmHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${encodeURIComponent(vmToken)}`,
        ...extra,
    }
}

async function request(label, path, {
    method = 'GET',
    headers = {},
    body,
    expectStatus = [200],
    expect = expectAny,
} = {}) {
    const started = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    let res
    try {
        res = await fetch(`${apiBase}${path}`, {
            method,
            headers: {
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        })
    } catch (error) {
        const elapsed = Math.round(performance.now() - started)
        results.push({
            label,
            method,
            path,
            status: 0,
            elapsed,
            ok: false,
            shape: 'request-error',
            keys: '',
            body: error instanceof Error ? error.message : String(error),
        })
        return { res: null, body: null, elapsed }
    } finally {
        clearTimeout(timeout)
    }
    const elapsed = Math.round(performance.now() - started)
    const text = await res.text()
    let parsed = text
    try {
        parsed = text ? JSON.parse(text) : null
    } catch {
        parsed = text
    }

    const statuses = Array.isArray(expectStatus) ? expectStatus : [expectStatus]
    const ok = statuses.includes(res.status) && expect(parsed, res)
    results.push({
        label,
        method,
        path,
        status: res.status,
        elapsed,
        ok,
        shape: Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed,
        keys: expectObject(parsed) ? Object.keys(parsed).slice(0, 8).join(',') : '',
        body: ok ? undefined : parsed,
    })

    return { res, body: parsed, elapsed }
}

async function grantAuditRoles() {
    await pool.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by)
        SELECT $1, role_id, 'administrator'
        FROM unnest($2::text[]) AS role_id
        ON CONFLICT DO NOTHING
    `, [runId, ['users', 'user_admin', 'system_admin', 'content_admin']])
}

async function cleanup() {
    await pool.query('DELETE FROM user_certificates WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM certificates WHERE owner = $1 OR created_by = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM vm_metrics WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vm_details WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vm_shutdown WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vms WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query("DELETE FROM roles WHERE id LIKE 'role_audit_%'").catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}

async function main() {
    await cleanup()

    const registration = await request('POST /user', '/user', {
        method: 'POST',
        body: { id: runId, name: 'Codex Audit', password },
        expectStatus: 201,
        expect: body => expectObject(body) && Boolean(body.token),
    })
    token = registration.body.token
    await grantAuditRoles()

    const login = await request('POST /auth/login/:id', `/auth/login/${runId}`, {
        method: 'POST',
        body: { password },
        expect: body => expectObject(body) && Boolean(body.token) && Array.isArray(body.roles),
    })
    token = login.body.token

    await request('GET /', '/', { expect: body => typeof body === 'string' && body.includes('Hanasand API') })
    await request('GET /auth/token/:id', `/auth/token/${runId}`, { headers: authHeaders(), expect: body => expectObject(body) && Boolean(body.token) })
    await request('GET /users', '/users', { headers: authHeaders(), expect: expectArray })
    await request('GET /user/:id', `/user/${runId}`, { expect: body => expectObject(body) && body.id === runId })
    await request('GET /user/full/:id', `/user/full/${runId}`, { headers: authHeaders(), expect: body => expectObject(body) && Array.isArray(body.roles) })
    await request('GET /roles', '/roles', { headers: authHeaders(), expect: expectArray })
    await request('GET /role/:id', '/role/users', { headers: authHeaders(), expect: expectObject })
    await request('GET /roles/user/:id', `/roles/user/${runId}`, { headers: authHeaders(), expect: expectArray })

    const roleId = `role_${runId}`
    await request('POST /role', '/role', {
        method: 'POST',
        headers: authHeaders(),
        body: { id: roleId, name: `Audit Role ${runId}`, description: 'Audit role', created_by: runId },
        expectStatus: 201,
        expect: body => expectObject(body) && body.id === roleId,
    })
    await request('PUT /role/:id', `/role/${roleId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: { name: `Audit Role Updated ${runId}`, description: 'Updated' },
        expect: body => expectObject(body) && body.id === roleId,
    })
    await request('POST /role/assign/:id', `/role/assign/${runId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: { role_id: roleId, target: roleId },
        expect: body => expectObject(body) && body.status === true,
    })
    await request('POST /role/unassign/:id', `/role/unassign/${runId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: { role_id: roleId },
        expect: body => expectObject(body) && body.status === true,
    })
    await request('DELETE /role/:id', `/role/${roleId}`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: { target: roleId },
        expect: body => expectObject(body) && Boolean(body.role),
    })

    const cert = await request('POST /certificates', '/certificates', {
        method: 'POST',
        headers: authHeaders(),
        body: { name: `cert-${runId}`, public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAuditKey codex' },
        expectStatus: 201,
        expect: body => expectObject(body) && body.ok === true,
    })
    await request('GET /certificates/:id', `/certificates/${cert.body.id}`, { expect: expectObject })
    await request('GET /certificates/user/:id', `/certificates/user/${runId}`, { headers: authHeaders(), expect: expectArray })
    await request('PUT /certificates/:id', `/certificates/${cert.body.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: { name: `cert-updated-${runId}` },
        expect: body => expectObject(body) && body.ok === true,
    })
    await request('DELETE /certificates/:id', `/certificates/${cert.body.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        expect: body => expectObject(body) && body.ok === true,
    })

    await request('GET /articles', '/articles', { expect: body => Array.isArray(body) || expectObject(body) })
    await request('GET /thoughts', '/thoughts', { expect: expectArray })
    await request('GET /thought/random', '/thought/random', { expect: () => true })
    await request('POST /pwned', '/pwned', {
        method: 'POST',
        body: { password },
        expect: expectObject,
    })

    const vmName = `vm-${runId}`
    await request('POST /vm', '/vm', {
        method: 'POST',
        headers: authHeaders(),
        body: { name: vmName, owner: runId, created_by: runId, access_users: [runId] },
        expectStatus: 201,
        expect: body => expectObject(body) && body.name === vmName,
    })
    await request('GET /vm/:id', `/vm/${vmName}`, { headers: authHeaders(), expect: expectArray })
    await request('GET /vms', '/vms', { headers: authHeaders(), expect: expectArray })
    await request('GET /vms/:user', `/vms/${runId}`, { headers: authHeaders(), expect: expectArray })
    await request('GET /vms/access/:user', `/vms/access/${runId}`, { headers: authHeaders(), expect: expectArray })
    await request('GET /vms/names', '/vms/names', { headers: vmHeaders(), expect: expectArray })
    await request('GET /vm/details/:name empty', `/vm/details/${vmName}`, { headers: authHeaders(), expectStatus: 200, expect: body => Array.isArray(body) || expectObject(body) })
    await request('POST /vm/details', '/vm/details', {
        method: 'POST',
        headers: vmHeaders(),
        body: {
            name: vmName,
            status: 'STOPPED',
            type: 'virtual-machine',
            architecture: 'x86_64',
            created: new Date().toISOString(),
            last_used: new Date().toISOString(),
            config_architecture: 'x86_64',
            config_image_architecture: 'amd64',
            config_image_description: 'audit image',
            config_image_label: 'release',
            config_image_os: 'ubuntu',
            config_image_release: 'noble',
            config_image_serial: 'audit',
            config_image_type: 'disk1.img',
            config_image_version: '24.04',
            limits_cpu: '1',
            limits_memory: '1GiB',
            volatile_base_image: 'audit',
            volatile_cloud_init_instance_id: 'audit',
            volatile_eth0_hwaddr: '00:16:3e:00:00:01',
            volatile_last_state_power: 'STOPPED',
            volatile_uuid: 'audit',
            volatile_uuid_generation: 'audit',
            volatile_vsock_id: '1',
            device_eth0_ipv4_address: '10.0.0.2',
            device_eth0_name: 'eth0',
            device_eth0_network: 'lxdbr0',
            device_eth0_type: 'nic',
            ephemeral: 'false',
            stateful: 'false',
            description: 'audit',
            profiles: ['default'],
        },
        expectStatus: 201,
        expect: body => expectObject(body) && body.name === vmName,
    })
    await request('GET /vm/details/:name', `/vm/details/${vmName}`, { headers: authHeaders(), expect: expectObject })
    await request('POST /vm/:id/:action invalid', `/vm/${vmName}/invalid`, {
        method: 'POST',
        headers: authHeaders(),
        expectStatus: 400,
        expect: expectObject,
    })
    const metric = await request('POST /vm/metrics', '/vm/metrics', {
        method: 'POST',
        headers: authHeaders(),
        body: { name: vmName, cpu_usage_percent: 12.5, cpu_cores: 1, power_state: 'off' },
        expectStatus: 201,
        expect: body => expectObject(body) && body.name === vmName,
    })
    await request('GET /vm/metrics/:id', `/vm/metrics/${vmName}`, { expect: expectArray })
    await request('PUT /vm/metrics/:id', `/vm/metrics/${metric.body.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: { cpu_usage_percent: 15.5 },
        expect: body => expectObject(body) && Number(body.cpu_usage_percent) === 15.5,
    })
    await request('DELETE /vm/metrics/:id', `/vm/metrics/${metric.body.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        expect: body => expectObject(body) && body.deleted === true,
    })
    await request('POST /vms/stop', '/vms/stop', {
        method: 'POST',
        headers: authHeaders(),
        body: { vms: [vmName] },
        expect: body => expectObject(body) && body.success === true && Array.isArray(body.vms),
    })
    await request('POST /vms/shutdown', '/vms/shutdown', {
        method: 'POST',
        headers: vmHeaders(),
        body: { vms: [vmName] },
        expectStatus: 201,
        expect: expectArray,
    })
    await request('DELETE /vm/:id', `/vm/${vmName}`, {
        method: 'DELETE',
        headers: authHeaders(),
        expect: body => expectObject(body) && Boolean(body.vm),
    })
    await request('DELETE /vms', '/vms', {
        method: 'DELETE',
        headers: vmHeaders(),
        body: { vms: [vmName] },
        expect: expectArray,
    })

    await request('GET /metrics', '/metrics', { headers: authHeaders(), expect: expectObject })
    await request('GET /docker', '/docker', { headers: authHeaders(), expect: expectObject })

    const failed = results.filter(result => !result.ok)
    console.table(results.map(({ body, ...result }) => result))
    if (failed.length) {
        console.error(JSON.stringify(failed, null, 2))
        process.exitCode = 1
    }

    await cleanup()
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
