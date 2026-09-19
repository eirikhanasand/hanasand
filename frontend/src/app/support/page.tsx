import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { PublicSupportPanel } from '@/components/support/publicSupportChat'
import { DashboardPage } from '@/components/dashboard/ui'
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
    return (
        <DashboardPage>
            {hasSession ? <SupportChat embedded /> : <PublicSupportPanel />}
        </DashboardPage>
    )
}
