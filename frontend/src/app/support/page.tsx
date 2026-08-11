import type { Metadata } from 'next'
import SupportChat from '@/components/support/supportChat'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Support',
    description: 'Support for Hanasand accounts, webhooks, API access, billing questions, and terms-of-service questions.',
    path: '/support',
    keywords: ['hanasand support', 'account support', 'webhook support', 'api support'],
})

export default function SupportPage() {
    return <main className='min-h-screen bg-ui-canvas px-4 py-10 text-ui-text'><div className='mx-auto grid max-w-6xl gap-4'><div><p className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-primary'>Support</p><h1 className='mt-2 text-3xl font-semibold'>Human support</h1><p className='mt-2 text-sm text-ui-muted'>Ask a question and follow the conversation from your account.</p></div><SupportChat embedded /></div></main>
}
