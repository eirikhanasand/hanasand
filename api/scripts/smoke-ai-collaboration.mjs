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

const runId = `ai_collab_${Date.now()}`
const ownerId = `${runId}_owner`
const reviewerId = `${runId}_reviewer`
const editorId = `${runId}_editor`
const ownerPassword = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const reviewerPassword = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const editorPassword = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const conversationId = `conversation_${Date.now()}`
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
    await pool.query('DELETE FROM ai_messages WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_conversation_collaborators WHERE conversation_id = $1', [conversationId]).catch(() => {})
    await pool.query('DELETE FROM ai_conversations WHERE id = $1', [conversationId]).catch(() => {})

    for (const id of [ownerId, reviewerId, editorId]) {
        await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]).catch(() => {})
        await pool.query('DELETE FROM tokens WHERE id = $1', [id]).catch(() => {})
        await pool.query('DELETE FROM users WHERE id = $1', [id]).catch(() => {})
    }
}

async function main() {
    await cleanup()

    await signup(ownerId, ownerPassword)
    await signup(reviewerId, reviewerPassword)
    await signup(editorId, editorPassword)

    const ownerToken = await login(ownerId, ownerPassword)
    const reviewerToken = await login(reviewerId, reviewerPassword)
    const editorToken = await login(editorId, editorPassword)

    const created = await request('/ai/conversations', {
        method: 'POST',
        headers: authHeaders(ownerId, ownerToken),
        body: JSON.stringify({
            id: conversationId,
            title: 'Collaboration smoke',
        }),
    })
    expect(created.response.status === 201, 'Failed to create AI conversation.', created.body)
    expect(created.body?.id === conversationId, 'Conversation create response returned the wrong id.', created.body)

    const invitedReviewer = await request(`/ai/conversations/${conversationId}/collaborators`, {
        method: 'POST',
        headers: authHeaders(ownerId, ownerToken),
        body: JSON.stringify({ userId: reviewerId, role: 'reviewer' }),
    })
    expect(invitedReviewer.response.status === 201, 'Failed to invite reviewer.', invitedReviewer.body)
    expect(invitedReviewer.body?.conversation?.collaboration?.collaborators?.some((entry) => entry.userId === reviewerId && entry.role === 'reviewer'), 'Reviewer was not reflected in the owner workspace payload.', invitedReviewer.body)

    const invitedEditor = await request(`/ai/conversations/${conversationId}/collaborators`, {
        method: 'POST',
        headers: authHeaders(ownerId, ownerToken),
        body: JSON.stringify({ userId: editorId, role: 'editor' }),
    })
    expect(invitedEditor.response.status === 201, 'Failed to invite editor.', invitedEditor.body)

    const reviewerWorkspace = await request('/ai/workspace', {
        headers: authHeaders(reviewerId, reviewerToken),
    })
    expect(reviewerWorkspace.response.status === 200, 'Reviewer workspace did not load.', reviewerWorkspace.body)
    const reviewerConversation = reviewerWorkspace.body?.conversations?.find((entry) => entry.id === conversationId)
    expect(reviewerConversation, 'Reviewer could not see the shared conversation.', reviewerWorkspace.body)
    expect(reviewerConversation.collaboration?.role === 'reviewer', 'Reviewer did not receive reviewer access.', reviewerConversation)

    const reviewerEdit = await request(`/ai/conversations/${conversationId}`, {
        method: 'PUT',
        headers: authHeaders(reviewerId, reviewerToken),
        body: JSON.stringify({ title: 'Reviewer should not be able to rename this' }),
    })
    expect(reviewerEdit.response.status === 403, 'Reviewer should not be able to edit the conversation.', reviewerEdit.body)

    const editorEdit = await request(`/ai/conversations/${conversationId}`, {
        method: 'PUT',
        headers: authHeaders(editorId, editorToken),
        body: JSON.stringify({ title: 'Editor update smoke' }),
    })
    expect(editorEdit.response.status === 200, 'Editor should be able to update the conversation.', editorEdit.body)
    expect(editorEdit.body?.title === 'Editor update smoke', 'Editor update did not persist.', editorEdit.body)

    const reviewerLeave = await request(`/ai/conversations/${conversationId}/collaborators/${reviewerId}`, {
        method: 'DELETE',
        headers: authHeaders(reviewerId, reviewerToken),
    })
    expect(reviewerLeave.response.status === 200, 'Reviewer should be able to leave the shared session.', reviewerLeave.body)
    expect(reviewerLeave.body?.ok === true, 'Reviewer leave did not report success.', reviewerLeave.body)

    const reviewerWorkspaceAfterLeave = await request('/ai/workspace', {
        headers: authHeaders(reviewerId, reviewerToken),
    })
    expect(reviewerWorkspaceAfterLeave.response.status === 200, 'Reviewer workspace reload failed after leaving.', reviewerWorkspaceAfterLeave.body)
    expect(!reviewerWorkspaceAfterLeave.body?.conversations?.some((entry) => entry.id === conversationId), 'Reviewer should no longer see the conversation after leaving.', reviewerWorkspaceAfterLeave.body)

    console.log(JSON.stringify({
        ok: true,
        conversationId,
        reviewerAccess: reviewerConversation.collaboration.role,
        editorTitle: editorEdit.body.title,
        reviewerRemoved: true,
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
