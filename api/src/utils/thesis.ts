import { queryOnce, withTransaction } from '#db'
import type WebSocket from 'ws'

export type ThesisDocument = { title: string, body: string, revision: number }
const clients = new Set<WebSocket>()
const columns = 'title, content AS body, revision::float8 AS revision'

export async function readThesis() {
    const result = await queryOnce(`SELECT ${columns} FROM thesis WHERE id = 1`)
    if (!result.rows[0]) throw new Error('The thesis is not initialized.')
    return result.rows[0] as ThesisDocument
}

export function validThesis(value: unknown): value is ThesisDocument {
    const document = value as ThesisDocument | null
    return typeof document?.title === 'string' && document.title.trim().length > 0
        && document.title.length <= 500 && !/[\r\n]/.test(document.title)
        && typeof document.body === 'string' && document.body.length <= 1_000_000
        && Number.isSafeInteger(document.revision) && document.revision >= 0
}

export async function compactThesisHistory(query = queryOnce) {
    // Keep the first checkpoint of each UTC eight-hour block after seven days.
    await query(`
        DELETE FROM thesis_history WHERE id IN (
            SELECT id FROM (
                SELECT id, row_number() OVER (
                    PARTITION BY floor(extract(epoch FROM saved_at) / 28800)
                    ORDER BY saved_at, revision
                ) AS position
                FROM thesis_history WHERE id <> 'previous' AND saved_at < NOW() - INTERVAL '7 days'
            ) ranked WHERE position > 1
        )
    `)
}

export async function saveThesis(document: ThesisDocument) {
    const result = await withTransaction(async query => {
        const current = (await query(`SELECT ${columns} FROM thesis WHERE id = 1 FOR UPDATE`)).rows[0] as ThesisDocument
        if (current.title === document.title && current.body === document.body) return { status: 200, document: current, changed: false }
        if (current.revision !== document.revision) return { status: 409, document: current, changed: false }
        // One durable checkpoint before the first edit in each twenty-minute window.
        await query(`
            INSERT INTO thesis_history (id, title, content, revision)
            VALUES (floor(extract(epoch FROM NOW()) / 1200)::text, $1, $2, $3)
            ON CONFLICT (id) DO NOTHING
        `, [current.title, current.body, current.revision])
        // This single replaceable row always preserves the immediate previous version.
        await query(`
            INSERT INTO thesis_history (id, title, content, revision)
            VALUES ('previous', $1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
                revision = EXCLUDED.revision, saved_at = NOW()
        `, [current.title, current.body, current.revision])
        const updated = await query(`
            UPDATE thesis SET title = $1, content = $2, revision = revision + 1, updated_at = NOW()
            WHERE id = 1 RETURNING ${columns}
        `, [document.title, document.body])
        await compactThesisHistory(query)
        return { status: 200, document: updated.rows[0] as ThesisDocument, changed: true }
    })
    if (result.changed) {
        for (const client of clients) send(client, result.document)
    }
    return result
}

function send(socket: WebSocket, document: ThesisDocument) {
    if (socket.readyState !== 1) return
    if (socket.bufferedAmount > 2_000_000) return socket.close(1013, 'Reconnect for the latest version')
    socket.send(JSON.stringify(document), error => { if (error) socket.close() })
}

export function subscribeThesis(socket: WebSocket) {
    clients.add(socket)
    socket.on('close', () => clients.delete(socket))
    socket.on('error', () => clients.delete(socket))
    void readThesis().then(document => send(socket, document)).catch(() => socket.close(1011))
}
