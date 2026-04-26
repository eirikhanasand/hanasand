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

const runId = `ai_owner_${Date.now()}`
const ownerId = `${runId}_owner`
const editorId = `${runId}_editor`
const ownerPassword = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const editorPassword = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const conversationId = `conversation_${Date.now()}`
const messageId = `message_${Date.now()}`
const pool = new Pool({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
})

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

function authHeaders(userId, token, extra = {}) {
    return {
        Authorization: `Bearer ${token}`,
        id: userId,
        ...extra,
    }
}

async function signup(id, password) {
    const response = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id, name: id, password }),
    })
    expect(response.response.status === 201, `Failed to create user ${id}.`, response.body)
}

async function login(id, password) {
    const response = await request(`/auth/login/${id}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(response.body?.token), `Failed to log in ${id}.`, response.body)
    return response.body.token
}

async function cleanup() {
    await pool.query('DELETE FROM ai_usage_events WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_messages WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_conversation_collaborators WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_conversations WHERE id = $1', [conversationId]).catch(() => {})

    for (const id of [ownerId, editorId]) {
        await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]).catch(() => {})
        await pool.query('DELETE FROM tokens WHERE id = $1', [id]).catch(() => {})
        await pool.query('DELETE FROM users WHERE id = $1', [id]).catch(() => {})
    }
}

async function main() {
    await cleanup()

    await signup(ownerId, ownerPassword)
    await signup(editorId, editorPassword)

    const ownerToken = await login(ownerId, ownerPassword)
    const editorToken = await login(editorId, editorPassword)

    const created = await request('/ai/conversations', {
        method: 'POST',
        headers: authHeaders(ownerId, ownerToken),
        body: JSON.stringify({
            id: conversationId,
            title: 'Ownership smoke',
        }),
    })
    expect(created.response.status === 201, 'Failed to create AI conversation.', created.body)

    const invitedEditor = await request(`/ai/conversations/${conversationId}/collaborators`, {
        method: 'POST',
        headers: authHeaders(ownerId, ownerToken),
        body: JSON.stringify({ userId: editorId, role: 'editor' }),
    })
    expect(invitedEditor.response.status === 201, 'Failed to invite editor.', invitedEditor.body)

    const postedMessage = await request(`/ai/conversations/${conversationId}/messages`, {
        method: 'PUT',
        headers: authHeaders(editorId, editorToken),
        body: JSON.stringify({
            id: messageId,
            role: 'user',
            content: 'Ownership event smoke from collaborator.',
        }),
    })
    expect(postedMessage.response.status === 201, 'Editor message write failed.', postedMessage.body)

    const ownerWorkspace = await request('/ai/workspace', {
        headers: authHeaders(ownerId, ownerToken),
    })
    expect(ownerWorkspace.response.status === 200, 'Owner workspace did not load.', ownerWorkspace.body)
    expect(ownerWorkspace.body?.ownershipSummary?.ownerIds?.includes(ownerId), 'Owner summary did not include the billing owner.', ownerWorkspace.body)
    expect(ownerWorkspace.body?.ownershipSummary?.ownedConversationCount === 1, 'Owned conversation count was not tracked.', ownerWorkspace.body)
    expect(ownerWorkspace.body?.ownershipSummary?.collaboratorSeatCount === 1, 'Collaborator seat count was not tracked.', ownerWorkspace.body)
    expect(ownerWorkspace.body?.ownershipSummary?.usageEventCount24h >= 3, 'Usage summary did not accumulate the expected events.', ownerWorkspace.body)
    const ownerRecentUsage = ownerWorkspace.body?.ownershipSummary?.recentUsage || []
    expect(ownerRecentUsage.some((event) => event.kind === 'message_written' && event.actorId === editorId && event.ownerId === ownerId), 'Collaborator message usage was not attributed back to the owner.', ownerWorkspace.body)

    const editorWorkspace = await request('/ai/workspace', {
        headers: authHeaders(editorId, editorToken),
    })
    expect(editorWorkspace.response.status === 200, 'Editor workspace did not load.', editorWorkspace.body)
    expect(editorWorkspace.body?.ownershipSummary?.sharedConversationCount === 1, 'Shared conversation count was not visible to the collaborator.', editorWorkspace.body)
    expect((editorWorkspace.body?.ownershipSummary?.recentUsage || []).some((event) => event.ownerId === ownerId), 'Collaborator workspace did not expose the shared owner context.', editorWorkspace.body)

    console.log(JSON.stringify({
        ok: true,
        ownerId,
        editorId,
        ownedConversationCount: ownerWorkspace.body.ownershipSummary.ownedConversationCount,
        sharedConversationCount: editorWorkspace.body.ownershipSummary.sharedConversationCount,
        recentUsageKinds: ownerRecentUsage.map((event) => event.kind),
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
