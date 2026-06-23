import type { Metadata } from 'next'
import LegalPage from '@/components/legal/legalPage'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Cookie settings',
    description: 'Cookie settings for Hanasand theme and required account cookies.',
    path: '/cookie-settings',
})

export default function CookieSettingsPage() {
    return (
        <LegalPage
            eyebrow='Settings'
            title='Cookie settings'
            description='Required account cookies stay on for the console. Theme preference can be changed from the header toggle at any time.'
            sections={[
                { title: 'Required account cookies', body: 'Login cookies are necessary for the customer console, API setup screens, webhooks, and protected pages.' },
                { title: 'Theme preference', body: 'Use the theme button in the header to switch between light and dark mode. The preference is stored as a small cookie.' },
                { title: 'Clearing local setup drafts', body: 'Webhook setup drafts are cleared after an alert is created. Browser storage can also be cleared from the browser settings if needed.' },
            ]}
        />
    )
}
