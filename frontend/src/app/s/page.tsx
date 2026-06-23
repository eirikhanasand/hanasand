import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../seo'
import randomId from '@/utils/random/randomId'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Workspace',
    description: 'Open a Hanasand workspace for notes, files, chat, and shareable monitoring reports.',
    path: '/s',
    keywords: ['workspace', 'hanasand ai', 'monitoring report', 'shareable workspace'],
})

export default function ShareEntryPage() {
    redirect(`/s/${randomId()}?new=1`)
}
