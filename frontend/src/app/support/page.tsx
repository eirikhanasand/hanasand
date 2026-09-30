import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { PublicSupportPanel, type PublicSupportConversation } from '@/components/support/publicSupportChat'
import { DashboardPage } from '@/components/dashboard/ui'
import config from '@/config'
import SupportChat from '@/components/support/supportChat'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Support',
    description: 'Support for Hanasand accounts, webhooks, API access, billing questions, and terms-of-service questions.',
    path: '/support',
    keywords: ['hanasand support', 'account support', 'webhook support', 'api support'],
})

type SupportTicket = { id: string; subject: string; status: string; updated_at: string; user_name?: string; last_message?: string; agent_name?: string; channel?: string; reply_count?: number; feedback_rating?: number | null; feedback_comment?: string | null; resolution_version?: number }
type SupportMessage = { id: string; sender_id: string | null; sender_kind?: string; sender_name: string; body: string; created_at: string }
type InitialSupportChat = { tickets: SupportTicket[]; isSupport: boolean; selectedId: string; messages: SupportMessage[]; realtime: boolean }

async function loadSupportChat(): Promise<InitialSupportChat | undefined> {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) return undefined
    const headers = new Headers({ Authorization: `Bearer ${token}`, id })
    const impersonationToken = cookieStore.get('impersonation_token')?.value
    if (impersonationToken) headers.set('x-impersonation-token', impersonationToken)
    try {
        const response = await fetch(`${config.url.api}/support/tickets`, { headers, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
        if (!response.ok) return undefined
        const payload = await response.json() as { tickets?: SupportTicket[]; isSupport?: boolean; realtime?: boolean }
        const tickets = payload.tickets || []
        const selectedId = tickets[0]?.id || ''
        let messages: SupportMessage[] = []
        if (selectedId) {
            const messageResponse = await fetch(`${config.url.api}/support/tickets/${encodeURIComponent(selectedId)}/messages`, { headers, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
            if (messageResponse.ok) messages = (await messageResponse.json() as { messages?: SupportMessage[] }).messages || []
        }
        return { tickets, isSupport: payload.isSupport === true, selectedId, messages, realtime: payload.realtime === true }
    } catch {
        return undefined
    }
}

export default async function SupportPage() {
    const cookieStore = await cookies()
    const hasSession = Boolean(cookieStore.get('access_token')?.value && cookieStore.get('id')?.value)
    const initialChat = hasSession ? await loadSupportChat() : undefined
    const supportSession = cookieStore.get('hanasand_support_render_session')?.value
    const selectedId = cookieStore.get('hanasand_support_render_conversation')?.value || ''
    let initialConversation: PublicSupportConversation | undefined
    if (!hasSession && supportSession && /^[a-f0-9]{64}$/.test(supportSession)) {
        try {
            const query = selectedId ? `?conversationId=${encodeURIComponent(selectedId)}` : ''
            const response = await fetch(`${config.url.api}/support/chat${query}`, { headers: { 'x-support-session': supportSession }, cache: 'no-store', signal: AbortSignal.timeout(5000) })
            if (response.ok) initialConversation = await response.json()
        } catch { /* The guest panel can still load and retry in the browser. */ }
    }
    return (
        <DashboardPage className='support-page'>
            {hasSession ? <SupportChat embedded initialChat={initialChat} /> : <PublicSupportPanel initialConversation={initialConversation} initialSelectedId={selectedId} />}
        </DashboardPage>
    )
}
