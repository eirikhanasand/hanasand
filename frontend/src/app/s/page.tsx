import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../seo'
import randomId from '@/utils/random/randomId'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Shared Workspace',
    description: 'Create or open a shared workspace from the browser.',
    path: '/s',
    keywords: ['shared workspace', 'hanasand ai', 'project workspace'],
})

export default function ShareEntryPage() {
    redirect(`/s/${randomId()}?new=1`)
}
