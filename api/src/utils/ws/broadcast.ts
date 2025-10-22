import { WebSocket } from 'ws'

type BroadCastProps = {
    data: any
    id: string
    clients: Map<string, Set<WebSocket>>
}

export default function broadcast({ data, id, clients: Clients }: BroadCastProps) {
    const clients = Clients.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'update',
        data,
        timestamp: new Date().toISOString(),
        participants: clients.size
    })

    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload)
        }
    }
}
