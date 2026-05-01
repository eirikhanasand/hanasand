import type { Metadata } from 'next'
import ShareEntryClient from './pageClient'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Shared Workspace',
    description: 'Create or open a shared workspace from the browser.',
    path: '/s',
    keywords: ['shared workspace', 'hanasand ai', 'project workspace'],
})

export default function ShareEntryPage() {
    return <ShareEntryClient />
}
