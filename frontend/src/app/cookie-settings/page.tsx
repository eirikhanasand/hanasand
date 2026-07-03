import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import CookieSettingsClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Cookie settings',
    description: 'Manage optional Hanasand cookie consent and browser-local product tokens.',
    path: '/cookie-settings',
})

export default function CookieSettingsPage() {
    return <CookieSettingsClient />
}
