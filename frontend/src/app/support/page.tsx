import type { Metadata } from 'next'
import { DashboardPage } from '@/components/dashboard/ui'
import SupportChat from '@/components/support/supportChat'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Support',
    description: 'Support for Hanasand accounts, webhooks, API access, billing questions, and terms-of-service questions.',
    path: '/support',
    keywords: ['hanasand support', 'account support', 'webhook support', 'api support'],
})

export default function SupportPage() {
    return (
        <DashboardPage>
            <SupportChat embedded />
        </DashboardPage>
    )
}
