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

export default async function SupportPage() {
    const cookieStore = await cookies()
    const hasSession = Boolean(cookieStore.get('access_token')?.value && cookieStore.get('id')?.value)
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
            {hasSession ? <SupportChat embedded /> : <PublicSupportPanel initialConversation={initialConversation} initialSelectedId={selectedId} />}
        </DashboardPage>
    )
}
