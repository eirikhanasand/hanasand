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
        if (msg.type !== 'edit') {
            return
        }

        broadcastUpdate(id, socket, msg.content, clients)
        queueSave(id, msg.content)
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

function queueSave(id: string, content: string) {
    if (pendingUpdates.has(id)) {
        const entry = pendingUpdates.get(id)!
        entry.content = content
        clearTimeout(entry.timer)
    }

    const timer = setTimeout(async () => {
        const entry = pendingUpdates.get(id)
        if (!entry) return
        try {
            await run(
                `UPDATE share SET content = $1, timestamp = NOW() WHERE id = $2`,
                [entry.content, id]
            )
            console.log(`Saved share ${id} to DB`)
        } catch (error) {
            console.error(`Failed to save share ${id}: ${error}`)
        } finally {
            pendingUpdates.delete(id)
        }
    }, 1000)

    pendingUpdates.set(id, { content, timer })
}
