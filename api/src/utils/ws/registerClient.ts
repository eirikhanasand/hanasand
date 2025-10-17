import { WebSocket } from 'ws'
import { bloomClients } from './handleMessage.ts'
import { WebSocket as WS } from 'ws'

export function registerClient(id: string, socket: WebSocket) {
    if (!bloomClients.has(id)) {
        bloomClients.set(id, new Set())
    }

    bloomClients.get(id)!.add(socket)
    broadcastJoin(id)
}

function broadcastJoin(id: string) {
    const clients = bloomClients.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'join',
        timestamp: new Date().toISOString(),
        participants: clients.size
    })

    for (const client of clients) {
        if (client.readyState === WS.OPEN) {
            client.send(payload)
        }
    }
}
