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

const runId = `notes_smoke_${Date.now()}`
const otherUserId = `${runId}_other`
const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
const otherPassword = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
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

async function signup(id, userPassword) {
    const created = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id, name: id, password: userPassword }),
    })
    expect(created.response.status === 201, `Failed to create notes smoke user ${id}.`, created.body)
}

async function login(id, userPassword) {
    const loggedIn = await request(`/auth/login/${id}`, {
        method: 'POST',
        body: JSON.stringify({ password: userPassword }),
    })
    expect(Boolean(loggedIn.body?.token), `Failed to log in notes smoke user ${id}.`, loggedIn.body)
    return loggedIn.body.token
}

async function cleanup() {
    for (const id of [runId, otherUserId]) {
        await pool.query('DELETE FROM notes WHERE owner_id = $1', [id]).catch(() => {})
        await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]).catch(() => {})
        await pool.query('DELETE FROM tokens WHERE id = $1', [id]).catch(() => {})
        await pool.query('DELETE FROM users WHERE id = $1', [id]).catch(() => {})
    }
}

async function main() {
    await cleanup()

    const unauthenticatedList = await request('/notes')
    expect([401, 403].includes(unauthenticatedList.response.status), 'Notes list should reject unauthenticated requests.', unauthenticatedList.body)

    await signup(runId, password)
    await signup(otherUserId, otherPassword)
    const token = await login(runId, password)
    const otherToken = await login(otherUserId, otherPassword)

    const created = await request('/notes', {
        method: 'POST',
        headers: authHeaders(runId, token),
        body: JSON.stringify({
            title: 'Notes smoke',
            content: 'Created from smoke test.',
            source: 'smoke',
        }),
    })
    expect(created.response.status === 201, 'Failed to create note.', created.body)
    expect(created.body?.owner_id === runId, 'Created note has the wrong owner.', created.body)
    expect(created.body?.source === 'smoke', 'Created note did not preserve source.', created.body)

    const noteId = created.body.id
    const otherList = await request('/notes', {
        headers: authHeaders(otherUserId, otherToken),
    })
    expect(otherList.response.status === 200, 'Other user could not list notes.', otherList.body)
    expect(Array.isArray(otherList.body) && !otherList.body.some((note) => note.id === noteId), 'Notes leaked across owners.', otherList.body)

    const listed = await request('/notes', {
        headers: authHeaders(runId, token),
    })
    expect(listed.response.status === 200, 'Failed to list notes.', listed.body)
    expect(Array.isArray(listed.body) && listed.body.some((note) => note.id === noteId), 'Created note was not listed.', listed.body)

    const fetched = await request(`/notes/${noteId}`, {
        headers: authHeaders(runId, token),
    })
    expect(fetched.response.status === 200, 'Failed to fetch note.', fetched.body)
    expect(fetched.body?.id === noteId, 'Fetched the wrong note.', fetched.body)

    const blockedFetch = await request(`/notes/${noteId}`, {
        headers: authHeaders(otherUserId, otherToken),
    })
    expect(blockedFetch.response.status === 404, 'Other user should not fetch the note.', blockedFetch.body)

    const cleared = await request(`/notes/${noteId}`, {
        method: 'PUT',
        headers: authHeaders(runId, token),
        body: JSON.stringify({ title: '', content: '', source: '' }),
    })
    expect(cleared.response.status === 200, 'Failed to clear note fields.', cleared.body)
    expect(cleared.body?.title === 'Untitled', 'Empty title should normalize to Untitled.', cleared.body)
    expect(cleared.body?.content === '', 'Content should be clearable.', cleared.body)
    expect(cleared.body?.source === 'api', 'Empty source should normalize to api.', cleared.body)

    const noFields = await request(`/notes/${noteId}`, {
        method: 'PUT',
        headers: authHeaders(runId, token),
        body: JSON.stringify({}),
    })
    expect(noFields.response.status === 400, 'Empty update should be rejected.', noFields.body)

    const deleted = await request(`/notes/${noteId}`, {
        method: 'DELETE',
        headers: authHeaders(runId, token),
    })
    expect(deleted.response.status === 200, 'Failed to delete note.', deleted.body)
    expect(deleted.body?.deleted === true, 'Delete response did not report success.', deleted.body)

    const missing = await request(`/notes/${noteId}`, {
        headers: authHeaders(runId, token),
    })
    expect(missing.response.status === 404, 'Deleted note should no longer be fetchable.', missing.body)

    console.log(JSON.stringify({
        ok: true,
        owner: runId,
        isolatedFrom: otherUserId,
        checked: [
            'unauthenticated rejection',
            'create/list/get',
            'owner isolation',
            'clearable fields',
            'empty update rejection',
            'delete',
        ],
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
