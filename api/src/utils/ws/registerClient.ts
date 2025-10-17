import { WebSocket } from 'ws'
import { pwnedClients } from './handleMessage.ts'
import { WebSocket as WS } from 'ws'

export function registerClient(id: string, socket: WebSocket) {
    if (!pwnedClients.has(id)) {
        pwnedClients.set(id, new Set())
    }

    pwnedClients.get(id)!.add(socket)
    broadcastJoin(id)
}

function broadcastJoin(id: string) {
    const clients = pwnedClients.get(id)
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
