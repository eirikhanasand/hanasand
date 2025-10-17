import { WebSocket as WS } from 'ws'
import { bloomClients } from './handleMessage.ts'

export function removeClient(id: string, socket: WS) {
    const clients = bloomClients.get(id)
    if (!clients) {
        return
    }

    clients.delete(socket)
    if (clients.size === 0) {
        bloomClients.delete(id)
    }
}
