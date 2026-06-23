import type { Metadata } from 'next'
import LegalPage from '@/components/legal/legalPage'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Terms of use',
    description: 'Terms of use for Hanasand monitoring, API, and customer console access.',
    path: '/terms',
})

export default function TermsPage() {
    return (
        <LegalPage
            eyebrow='Terms'
            title='Terms of use'
            description='Plain-language terms for using Hanasand monitoring, webhook, API, and console surfaces.'
            sections={[
                { title: 'Use of the service', body: 'Hanasand provides monitoring and metadata workflows for legitimate security, risk, and operational review. Customers are responsible for using alerts and exports in line with applicable laws and internal policies.' },
                { title: 'Accounts and access', body: 'Keep credentials private, restrict access to people who need the product, and contact Hanasand if an account or webhook endpoint should be disabled.' },
                { title: 'Data and availability', body: 'Monitoring data can change as sources update, disappear, or require review. Hanasand aims to deliver timely, useful alerts while preserving review boundaries around sensitive material.' },
            ]}
        />
    )
}
