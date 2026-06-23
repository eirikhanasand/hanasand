import type { Metadata } from 'next'
import LegalPage from '@/components/legal/legalPage'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Privacy policy',
    description: 'Privacy policy for Hanasand customer accounts, monitoring terms, and webhook configuration.',
    path: '/privacy',
})

export default function PrivacyPage() {
    return (
        <LegalPage
            eyebrow='Privacy'
            title='Privacy policy'
            description='How Hanasand handles account data, watched terms, webhook settings, and operational logs.'
            sections={[
                { title: 'Account data', body: 'Hanasand stores the account details needed to authenticate users, route console access, and support customer workflows.' },
                { title: 'Monitoring inputs', body: 'Watched company names, domains, vendors, and webhook destinations are used to deliver the monitoring workflow requested by the customer.' },
                { title: 'Operational logs', body: 'Service logs may include request timing, route status, and delivery state so the product can be secured, debugged, and improved.' },
            ]}
        />
    )
}
