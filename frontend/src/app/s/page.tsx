import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../seo'
import randomId from '@/utils/random/randomId'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Production Workspace',
    description: 'Build, verify, deploy, and recover websites in Hanasand.',
    path: '/s',
    keywords: ['production workspace', 'hanasand ai', 'verified deploy', 'website rollback'],
})

export default function ShareEntryPage() {
    redirect(`/s/${randomId()}?new=1`)
}
