import type { Metadata } from 'next'
import LegalPage from '@/components/legal/legalPage'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Cookie policy',
    description: 'Cookie policy for Hanasand authentication, theme preference, and console state.',
    path: '/cookies',
})

export default function CookiesPage() {
    return (
        <LegalPage
            eyebrow='Cookies'
            title='Cookie policy'
            description='Cookies keep the product usable: authentication, theme preference, and basic console continuity.'
            sections={[
                { title: 'Required cookies', body: 'Authentication cookies keep users signed in and route protected console pages correctly. These are required for logged-in product use.' },
                { title: 'Preference cookies', body: 'The theme cookie remembers light or dark mode so pages load with the selected appearance.' },
                { title: 'Local browser storage', body: 'Some setup flows can use local browser storage for drafts, such as a webhook configuration handoff before an alert is created.' },
            ]}
        />
    )
}
