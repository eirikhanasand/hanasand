import './guard-production-smoke.mjs'
import crypto from 'crypto'
import pg from 'pg'

const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
const dbHost = process.env.DB_HOST || '127.0.0.1'
const dbPort = Number(process.env.DB_PORT || 8503)
const dbName = process.env.DB || 'hanasand'
const dbUser = process.env.DB_USER || 'hanasand'
const dbPassword = process.env.DB_PASSWORD
const runLive = process.env.RUN_ADMIN_SUPPORT_LIVE_SMOKE === '1'
const keepData = process.env.KEEP_ADMIN_SUPPORT_SMOKE_DATA === '1'
const { Pool } = pg

if (!runLive || !dbPassword) {
    printChecklist()
    process.exit(0)
}

const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
const adminOneId = `admin_support_${suffix}_requester`
const adminTwoId = `admin_support_${suffix}_approver`
const orgId = `admin_support_${suffix}_org`
const approveRequestId = `admin-support-${suffix}-approve`
const denyRequestId = `admin-support-${suffix}-deny`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

let adminOneToken = ''
let adminTwoToken = ''

function printChecklist() {
    console.log([
        'Admin access recovery live smoke is ready but not running.',
        '',
        'Prerequisites:',
        '- API is already listening locally, for example API_BASE=http://127.0.0.1:8080/api',
        '- Postgres is already listening; this script will not start Docker',
        '- DB_PASSWORD is set, plus optional DB_HOST, DB_PORT, DB, DB_USER',
        '- RUN_ADMIN_SUPPORT_LIVE_SMOKE=1 is set to allow live mutations',
        '',
        'One-command live check:',
        'RUN_ADMIN_SUPPORT_LIVE_SMOKE=1 API_BASE=${API_BASE:-http://127.0.0.1:8080/api} DB_HOST=${DB_HOST:-127.0.0.1} DB_PORT=${DB_PORT:-8503} DB_PASSWORD=... bun scripts/smoke-admin-access-recovery-live.mjs',
        '',
        'The live check creates two temporary admins and one temporary org, verifies support inspection by org/email/request, pending recovery revokes the invite, approval re-enables it, denial keeps it revoked, approval search filters work by request/status/outcome/requester/approver, and audit ids are returned.',
        'Set KEEP_ADMIN_SUPPORT_SMOKE_DATA=1 to keep the seeded records for manual inspection.',
    ].join('\n'))
}

function expect(condition, message, details) {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) error.details = details
        throw error
    }
}

function authHeaders(userId, token, extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: userId,
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

async function signup(id, name) {
    const created = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id, name, password }),
    })
    expect(created.response.status === 201, `Failed to create user ${id}.`, created.body)
}

async function login(id) {
    const loggedIn = await request(`/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(loggedIn.body?.token), `Failed to log in user ${id}.`, loggedIn.body)
    return loggedIn.body.token
}

async function seed() {
    await cleanup()
    await signup(adminOneId, 'Admin Support Smoke Requester')
    await signup(adminTwoId, 'Admin Support Smoke Approver')
    await pool.query(`
        INSERT INTO roles (id, name, description, priority, created_by)
        VALUES ('administrator', 'Administrator', 'Full administrative access', 0, $1)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `, [adminOneId])
    await pool.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by)
        VALUES ($1, 'administrator', $1), ($2, 'administrator', $1)
        ON CONFLICT (user_id, role_id) DO NOTHING
    `, [adminOneId, adminTwoId])
    await pool.query(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, updated_at = NOW()
    `, [orgId, 'Admin Support Smoke Org', orgId, adminOneId])
    adminOneToken = await login(adminOneId)
    adminTwoToken = await login(adminTwoId)
}

async function cleanup() {
    await pool.query('DELETE FROM admin_audit_events WHERE request_id = ANY($1::text[]) OR actor_id = ANY($2::text[])', [[approveRequestId, denyRequestId], [adminOneId, adminTwoId]]).catch(() => {})
    await pool.query('DELETE FROM admin_access_recovery_approvals WHERE request_id = ANY($1::text[])', [[approveRequestId, denyRequestId]]).catch(() => {})
    await pool.query('DELETE FROM organization_invites WHERE organization_id = $1', [orgId]).catch(() => {})
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1 OR user_id = ANY($2::text[])', [orgId, [adminOneId, adminTwoId]]).catch(() => {})
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {})
    await pool.query('DELETE FROM user_roles WHERE user_id = ANY($1::text[])', [[adminOneId, adminTwoId]]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = ANY($1::text[])', [[adminOneId, adminTwoId]]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[adminOneId, adminTwoId]]).catch(() => {})
}

async function createRecovery(requestId, email) {
    const recovery = await request(`/admin/support/organizations/${encodeURIComponent(orgId)}/access-recovery`, {
        method: 'POST',
        headers: authHeaders(adminOneId, adminOneToken, { 'x-request-id': requestId }),
        body: JSON.stringify({
            email,
            role: 'admin',
            reason: `High-risk owner recovery smoke ${requestId}`,
            context: `live-smoke ${requestId}`,
            approvalRequired: true,
        }),
    })
    expect(recovery.response.status === 201, `Failed to create recovery ${requestId}.`, recovery.body)
    expect(recovery.body?.recovery?.approvalStatus === 'pending_approval', 'High-risk recovery should start pending approval.', recovery.body)
    expect(recovery.body?.recovery?.invite?.status === 'revoked', 'High-risk recovery invite should be revoked until approved.', recovery.body)
    return recovery.body.recovery
}

async function searchApproval(params, expectedCount = 1) {
    const query = new URLSearchParams(params)
    const result = await request(`/admin/support/access-recovery?${query}`, {
        headers: authHeaders(adminTwoId, adminTwoToken),
    })
    expect(result.response.status === 200, 'Approval search failed.', result.body)
    expect((result.body?.approvals || []).length >= expectedCount, 'Approval search returned too few records.', result.body)
    return result.body.approvals
}

async function inspectSupportState(params) {
    const query = new URLSearchParams(params)
    const result = await request(`/admin/support/inspect?${query}`, {
        headers: authHeaders(adminTwoId, adminTwoToken),
    })
    expect(result.response.status === 200, 'Support inspection failed.', result.body)
    expect((result.body?.inspection?.auditEventIds || []).length > 0, 'Support inspection should include audit event ids.', result.body)
    expect((result.body?.inspection?.recoveryEligibility || []).length > 0, 'Support inspection should include recovery eligibility.', result.body)
    return result.body.inspection
}

async function decide(requestId, action, expectedStatus) {
    const result = await request(`/admin/support/access-recovery/${encodeURIComponent(requestId)}/${action}`, {
        method: 'POST',
        headers: authHeaders(adminTwoId, adminTwoToken),
        body: JSON.stringify({
            reason: `${action} access recovery smoke request ${requestId}`,
            context: `live-smoke-decision ${requestId}`,
        }),
    })
    expect(result.response.status === 200, `Failed to ${action} recovery ${requestId}.`, result.body)
    expect(result.body?.decision?.status === expectedStatus, `Unexpected ${action} decision status.`, result.body)
    return result.body.decision
}

async function verifyUnauthorizedSearchIsBlocked() {
    const result = await request('/admin/support/access-recovery')
    expect([401, 403].includes(result.response.status), 'Unauthenticated approval search should be blocked.', result.body)
}

async function main() {
    await pool.query('SELECT 1')
    await seed()
    await verifyUnauthorizedSearchIsBlocked()

    const approveRecovery = await createRecovery(approveRequestId, `support-${suffix}-approve@example.test`)
    const inspection = await inspectSupportState({ org: orgId, email: approveRecovery.invite.email, request: approveRequestId, outcome: 'success' })
    expect(inspection.pendingInvites.length === 0, 'Pending high-risk inspection should not expose a shareable invite before approval.', inspection)
    expect(inspection.invites[0]?.status === 'revoked', 'Inspection should show the high-risk invite as revoked until approved.', inspection)
    let approvals = await searchApproval({ request: approveRequestId, status: 'pending_approval', outcome: 'success' })
    expect(approvals[0].invite.status === 'revoked', 'Pending approval search should show revoked invite.', approvals[0])
    expect((approvals[0].auditEventIds || []).length > 0, 'Pending approval search should include audit event ids.', approvals[0])

    const approved = await decide(approveRequestId, 'approve', 'approved')
    expect(approved.approvedBy === adminTwoId, 'Approval should record approving admin.', approved)
    approvals = await searchApproval({ request: approveRequestId, status: 'approved', outcome: 'success', requester: adminOneId, approver: adminTwoId })
    expect(approvals[0].invite.status === 'pending', 'Approved recovery should re-enable invite as pending.', approvals[0])
    expect((approvals[0].auditEventIds || []).length >= 2, 'Approved recovery search should include create and approve audit ids.', approvals[0])

    const denyRecovery = await createRecovery(denyRequestId, `support-${suffix}-deny@example.test`)
    expect(denyRecovery.invite.status === 'revoked', 'Deny flow should start with revoked invite.', denyRecovery)
    const denied = await decide(denyRequestId, 'deny', 'denied')
    expect(denied.deniedBy === adminTwoId, 'Denial should record denying admin.', denied)
    approvals = await searchApproval({ request: denyRequestId, status: 'denied', outcome: 'denied', requester: adminOneId, approver: adminTwoId })
    expect(approvals[0].invite.status === 'revoked', 'Denied recovery should keep invite revoked.', approvals[0])
    expect((approvals[0].auditEventIds || []).length >= 2, 'Denied recovery search should include create and deny audit ids.', approvals[0])

    console.log('Admin access recovery live smoke passed.')
    console.log(JSON.stringify({
        schemaVersion: 'support.access_recovery.live_smoke_result.v1',
        orgId,
        approveRequestId,
        denyRequestId,
        approveInviteId: approveRecovery.invite.id,
        denyInviteId: denyRecovery.invite.id,
        auditSearch: `/api/admin/support/access-recovery?request=${encodeURIComponent(approveRequestId)}&status=approved&outcome=success`,
    }, null, 2))
}

main()
    .catch(error => {
        console.error('Admin access recovery live smoke failed.')
        console.error(error?.stack || error)
        if (error?.details !== undefined) console.error(JSON.stringify(error.details, null, 2))
        process.exitCode = 1
    })
    .finally(async () => {
        if (!keepData) await cleanup()
        await pool.end().catch(() => {})
    })
