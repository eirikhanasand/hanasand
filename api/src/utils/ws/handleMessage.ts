import type { RawData } from 'ws'
import { WebSocket as WS } from 'ws'
import { pendingUpdates } from '../../plugins/ws'
import run from '#db'
import { validateSession } from '#utils/auth/session.ts'
import { contentOrganizationAccess } from '#utils/contentOrganization.ts'

export async function handleMessage(
    id: string,
    socket: WS,
    rawMessage: RawData,
    clients: Map<string, Set<WS>>,
) {
    let validEdit = false
    try {
        const msg = JSON.parse(rawMessage.toString())
        if (msg.type !== 'edit' || typeof msg.content !== 'string') {
            return
        }
        validEdit = true

        const share = await run('SELECT organization_id FROM share WHERE id = $1', [id])
        if (!share.rows.length) throw new Error('Share no longer exists')
        let userId: string | null = null
        if (share.rows[0].organization_id) {
            const session = typeof msg.userId === 'string' && typeof msg.token === 'string'
                ? await validateSession({ id: msg.userId, token: msg.token }).catch(() => null) : null
            userId = session?.user.id || null
            if (!userId || !await contentOrganizationAccess(share.rows[0].organization_id, userId, true)) {
                socket.send(JSON.stringify({ type: 'error', error: 'You do not have permission to edit this organization’s share.' }))
                return
            }
        }

        broadcastUpdate(id, socket, msg.content, clients)
        queueSave(id, socket, msg.content, userId)
    } catch (error) {
        console.error(`Failed to process WebSocket message: ${error}`)
        if (validEdit && socket.readyState === WS.OPEN) socket.send(JSON.stringify({ type: 'error', error: 'Unable to save your changes. Please retry.' }))
    }
}

function broadcastUpdate(id: string, sender: WS, content: string, Clients: Map<string, Set<WS>>) {
    const clients = Clients.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'update',
        content,
        timestamp: new Date().toISOString(),
        participants: clients.size
    })

    for (const client of clients) {
        if (client !== sender && client.readyState === WS.OPEN) {
            client.send(payload)
        }
    }
}

function queueSave(id: string, socket: WS, content: string, userId: string | null) {
    if (pendingUpdates.has(id)) {
        const entry = pendingUpdates.get(id)!
        clearTimeout(entry.timer)
    }

    const timer = setTimeout(async () => {
        const entry = pendingUpdates.get(id)
        if (!entry) return
        try {
            const result = await run(
                `UPDATE share SET content = $1, updated_at = NOW() WHERE id = $2
                 AND (organization_id IS NULL OR content_organization_access(organization_id, $3, TRUE)) RETURNING id`,
                [entry.content, id, entry.userId || null]
            )
            if (!result.rows.length) throw new Error('Share no longer exists')
            if (socket.readyState === WS.OPEN) socket.send(JSON.stringify({ type: 'ack', content: entry.content }))
        } catch (error) {
            console.error(`Failed to save share ${id}: ${error}`)
            if (socket.readyState === WS.OPEN) socket.send(JSON.stringify({ type: 'error', error: 'Unable to save your changes. Please retry.' }))
        } finally {
            if (pendingUpdates.get(id) === entry) pendingUpdates.delete(id)
        }
    }, 1000)

    pendingUpdates.set(id, { content, timer, userId })
}
