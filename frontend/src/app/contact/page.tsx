import type { Metadata } from 'next'
import Contact from '@/components/contact/contact'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Contact',
    description: 'Contact support or send product, monitoring, API, and collaboration questions.',
    path: '/contact',
    keywords: ['contact', 'hanasand', 'developer'],
})

type ContactPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function page({ searchParams }: ContactPageProps) {
    const params = await searchParams
    const rawPlan = params?.plan
    const rawIntent = params?.intent
    const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan
    const intent = Array.isArray(rawIntent) ? rawIntent[0] : rawIntent
    return <Contact plan={plan || ''} intent={intent || ''} />
}
