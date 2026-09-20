import type { Page, WebSocketRoute } from '@playwright/test'
export const supportTicketId = '11111111-1111-4111-8111-111111111111'
export function supportSnapshot(messages: { sender_kind: string; sender_name: string }[], channel = 'ai') {
    return { id: supportTicketId, agent_name: messages.filter(message => message.sender_kind === 'support').at(-1)?.sender_name,
        tickets: [{ id: supportTicketId, subject: 'Support question', reply_count: messages.filter(message => ['assistant', 'support'].includes(message.sender_kind)).length }],
        channel, messages, status: 'open', pending: false }
}
export async function mockSupportLive(page: Page) {
    const sockets = new Set<WebSocketRoute>()
    await page.route('**/api/support/chat*', async route => {
        if (route.request().method() === 'POST' && route.request().postDataJSON().action === 'connect') await route.fulfill({ json: { ticket: 'a'.repeat(64) } })
        else await route.fallback()
    })
    await page.routeWebSocket('**/api/ws/support', socket => {
        sockets.add(socket)
        socket.onMessage(() => socket.send(JSON.stringify({ type: 'ready' })))
        socket.onClose(() => sockets.delete(socket))
    })
    return { notify: () => { for (const socket of sockets) socket.send(JSON.stringify({ type: 'changed' })) }, close: () => { for (const socket of sockets) socket.close() } }
}
