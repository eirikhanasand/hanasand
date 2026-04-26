import type { Metadata } from 'next'
import ShareEntryClient from './pageClient'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Shared Workspace',
    description: 'Create or open a shared workspace from the browser.',
    path: '/s',
    keywords: ['shared workspace', 'hanasand ai', 'project workspace'],
})

export default async function ShareEntryPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const resolvedSearchParams = await searchParams
    const mode = typeof resolvedSearchParams?.mode === 'string' ? resolvedSearchParams.mode : null
    const initialMode = mode === 'project' ? 'project' : 'share'

    return <ShareEntryClient initialMode={initialMode} />
}
