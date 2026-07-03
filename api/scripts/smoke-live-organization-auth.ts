import assert from 'node:assert/strict'

type JsonRecord = Record<string, any>

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log([
        'Usage:',
        '  API_LIVE_BASE_URL=https://api.example.com/api \\',
        '  API_LIVE_OWNER_ID=user_owner API_LIVE_OWNER_TOKEN=... API_LIVE_OWNER_EMAIL=owner@example.com \\',
        '  API_LIVE_MEMBER_ID=user_member API_LIVE_MEMBER_TOKEN=... API_LIVE_MEMBER_EMAIL=member@example.com \\',
        '  bun scripts/smoke-live-organization-auth.ts',
        '',
        'Optional:',
        '  API_LIVE_OUTSIDER_ID=user_outsider API_LIVE_OUTSIDER_TOKEN=...',
        '  API_LIVE_ORGANIZATION_ID=org_live_auth_probe_...',
        '  API_LIVE_CREATE_ORGANIZATION=false'
    ].join('\n'))
    process.exit(0)
}

const baseUrl = requiredEnv('API_LIVE_BASE_URL').replace(/\/+$/, '')
const owner = actor('OWNER')
const member = actor('MEMBER')
const outsider = optionalActor('OUTSIDER')
const organizationId = env('API_LIVE_ORGANIZATION_ID') || `org_live_auth_probe_${Date.now()}`
const createOrganization = env('API_LIVE_CREATE_ORGANIZATION') !== 'false'
const startedAt = new Date().toISOString()

let organization: JsonRecord
if (createOrganization) {
    const created = await postJson('/organizations', owner, {
        id: organizationId,
        name: `Live auth probe ${organizationId}`,
        slug: organizationId.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60),
    })
    assert.ok([200, 201].includes(created.response.status), `organization create/upsert failed: ${created.response.status} ${JSON.stringify(created.body)}`)
    organization = created.body.organization
} else {
    const existing = await getJson(`/organizations/${encodeURIComponent(organizationId)}`, owner)
    assert.equal(existing.response.status, 200, `organization read failed: ${existing.response.status} ${JSON.stringify(existing.body)}`)
    organization = existing.body.organization
}

assert.equal(organization.id, organizationId)
assert.equal(organization.tenantId ?? organization.id, organizationId)
assert.ok(['owner', 'admin'].includes(String(organization.role ?? 'owner')), 'owner token must have owner/admin role on the probe organization.')

const invite = await postJson(`/organizations/${encodeURIComponent(organizationId)}/invites`, owner, {
    email: member.email,
    role: 'member',
    requestId: `live-member-invite-${Date.now()}`
})
assert.equal(invite.response.status, 201, `member invite failed: ${invite.response.status} ${JSON.stringify(invite.body)}`)
const inviteId = String(invite.body.invites?.[0]?.id ?? invite.body.invite?.id ?? '')
assert.ok(inviteId, 'member invite did not return an invite id.')

const accepted = await postJson(`/organizations/invites/${encodeURIComponent(inviteId)}/accept`, member, {})
assert.ok([200, 409].includes(accepted.response.status), `member invite accept failed: ${accepted.response.status} ${JSON.stringify(accepted.body)}`)
if (accepted.response.status === 200) {
    assert.equal(accepted.body.membership?.role, 'member')
    assert.equal(accepted.body.inviteAcceptance?.organizationId, organizationId)
    assert.equal(accepted.body.inviteAcceptance?.tenantId, organizationId)
}

const memberRead = await getJson(`/organizations/${encodeURIComponent(organizationId)}`, member)
assert.equal(memberRead.response.status, 200, `member organization read failed: ${memberRead.response.status} ${JSON.stringify(memberRead.body)}`)
assert.equal(memberRead.body.organization?.id, organizationId)
assert.equal(memberRead.body.organization?.tenantId ?? organizationId, organizationId)
assert.equal(memberRead.body.organization?.role, 'member')

const memberSettingsDenied = await putJson(`/organizations/${encodeURIComponent(organizationId)}/settings`, member, {
    alertVisibilityPolicy: 'admins',
    requestId: `live-member-settings-denied-${Date.now()}`
})
assert.equal(memberSettingsDenied.response.status, 403, `member settings mutation should be denied: ${memberSettingsDenied.response.status} ${JSON.stringify(memberSettingsDenied.body)}`)
assert.equal(memberSettingsDenied.body.settingsMutationDenial?.organizationId ?? memberSettingsDenied.body.organizationAccessDenial?.organizationId, organizationId)
assert.equal(memberSettingsDenied.body.settingsMutationDenial?.nonmemberEnumeration ?? memberSettingsDenied.body.organizationAccessDenial?.nonmemberEnumeration, false)

const ownerSettings = await putJson(`/organizations/${encodeURIComponent(organizationId)}/settings`, owner, {
    defaultWebhookPolicy: 'manual_selection',
    alertVisibilityPolicy: 'members',
    requestId: `live-owner-settings-${Date.now()}`
})
assert.equal(ownerSettings.response.status, 200, `owner settings mutation failed: ${ownerSettings.response.status} ${JSON.stringify(ownerSettings.body)}`)
assert.equal(ownerSettings.body.organization?.id, organizationId)
assert.equal(ownerSettings.body.permissions?.canEdit, true)

let outsiderStatus: number | undefined
if (outsider) {
    const outsiderRead = await getJson(`/organizations/${encodeURIComponent(organizationId)}`, outsider)
    outsiderStatus = outsiderRead.response.status
    assert.equal(outsiderRead.response.status, 404, `outsider organization read should be not found: ${outsiderRead.response.status} ${JSON.stringify(outsiderRead.body)}`)
    assert.equal(outsiderRead.body.organizationAccessDenial?.nonmemberEnumeration, false)
}

console.log(JSON.stringify({
    event: 'live_organization_auth_smoke',
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    organizationId,
    ownerRole: organization.role ?? 'owner',
    memberRole: memberRead.body.organization?.role,
    memberReadStatus: memberRead.response.status,
    memberSettingsDeniedStatus: memberSettingsDenied.response.status,
    ownerSettingsStatus: ownerSettings.response.status,
    outsiderReadStatus: outsiderStatus,
}, null, 2))

async function getJson(path: string, auth: Actor) {
    const response = await fetch(`${baseUrl}${path}`, { headers: headers(auth) })
    return { response, body: await jsonBody(response) }
}

async function postJson(path: string, auth: Actor, body: JsonRecord) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { ...headers(auth), 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    return { response, body: await jsonBody(response) }
}

async function putJson(path: string, auth: Actor, body: JsonRecord) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'PUT',
        headers: { ...headers(auth), 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    return { response, body: await jsonBody(response) }
}

async function jsonBody(response: Response): Promise<JsonRecord> {
    const text = await response.text()
    if (!text) return {}
    try {
        return JSON.parse(text) as JsonRecord
    } catch {
        return { raw: text }
    }
}

function headers(auth: Actor) {
    return {
        authorization: `Bearer ${auth.token}`,
        id: auth.id,
        'x-actor-id': auth.id,
        'x-user-email': auth.email,
    }
}

type Actor = {
    id: string
    token: string
    email: string
}

function actor(prefix: 'OWNER' | 'MEMBER'): Actor {
    return {
        id: requiredEnv(`API_LIVE_${prefix}_ID`),
        token: requiredEnv(`API_LIVE_${prefix}_TOKEN`),
        email: requiredEnv(`API_LIVE_${prefix}_EMAIL`),
    }
}

function optionalActor(prefix: 'OUTSIDER'): Actor | undefined {
    const id = env(`API_LIVE_${prefix}_ID`)
    const token = env(`API_LIVE_${prefix}_TOKEN`)
    if (!id && !token) return undefined
    if (!id || !token) throw new Error(`Both API_LIVE_${prefix}_ID and API_LIVE_${prefix}_TOKEN are required when testing outsider access.`)
    return {
        id,
        token,
        email: env(`API_LIVE_${prefix}_EMAIL`) || 'outsider@example.com',
    }
}

function env(name: string) {
    return process.env[name]?.trim()
}

function requiredEnv(name: string) {
    const value = env(name)
    if (!value) {
        throw new Error(`Missing ${name}. Run with --help for required live organization auth probe variables.`)
    }
    return value
}
