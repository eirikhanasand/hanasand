import type { RawData } from 'ws'
import { WebSocket as WS } from 'ws'
import { pendingUpdates } from '../../plugins/ws'
import run from '#db'

export async function handleMessage(
    id: string,
    socket: WS,
    rawMessage: RawData,
    clients: Map<string, Set<WS>>,
) {
    try {
        const msg = JSON.parse(rawMessage.toString())
        if (msg.type !== 'edit' || typeof msg.content !== 'string') {
            return
        }

        broadcastUpdate(id, socket, msg.content, clients)
        queueSave(id, socket, msg.content)
    } catch (error) {
        console.error(`Invalid WebSocket message: ${error}`)
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

function queueSave(id: string, socket: WS, content: string) {
    if (pendingUpdates.has(id)) {
        const entry = pendingUpdates.get(id)!
        clearTimeout(entry.timer)
    }

    const timer = setTimeout(async () => {
        const entry = pendingUpdates.get(id)
        if (!entry) return
        try {
            const result = await run(
                'UPDATE share SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
                [entry.content, id]
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

    pendingUpdates.set(id, { content, timer })
}
