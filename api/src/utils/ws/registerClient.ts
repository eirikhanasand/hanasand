import { WebSocket } from 'ws'

export function registerClient(id: string, socket: WebSocket, clients: Map<string, Set<WebSocket>>, participantCount?: (id: string, clients: Map<string, Set<WebSocket>>) => number) {
    if (!clients.has(id)) {
        clients.set(id, new Set())
    }

    clients.get(id)!.add(socket)
    broadcastJoin(id, clients, participantCount)
}

function broadcastJoin(id: string, Clients: Map<string, Set<WebSocket>>, participantCount?: (id: string, clients: Map<string, Set<WebSocket>>) => number) {
    const clients = Clients.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'join',
        timestamp: new Date().toISOString(),
        participants: participantCount ? participantCount(id, Clients) : clients.size
    })

    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload)
        }
    }
}
