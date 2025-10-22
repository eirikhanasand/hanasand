import { WebSocket as WS } from 'ws'

export function removeClient(id: string, socket: WS, Clients: Map<string, Set<WS>>) {
    const clients = Clients.get(id)
    if (!clients) {
        return
    }

    clients.delete(socket)
    if (clients.size === 0) {
        Clients.delete(id)
    }
}
