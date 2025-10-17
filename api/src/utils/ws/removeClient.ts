import { WebSocket as WS } from 'ws'
import { pwnedClients } from './handleMessage.ts'

export function removeClient(id: string, socket: WS) {
    const clients = pwnedClients.get(id)
    if (!clients) {
        return
    }

    clients.delete(socket)
    if (clients.size === 0) {
        pwnedClients.delete(id)
    }
}
