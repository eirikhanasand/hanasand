import PwnedPageClient from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Bloom Hash Exposure Lookup',
    description: 'Check Bloom-index exposure using a SHA-1 hash and prefix-only range lookup.',
    path: '/pwned',
    keywords: ['bloom hash lookup', 'sha-1 hash prefix', 'exposure lookup'],
})

export default async function Page() {
    return (
        <main className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center'>
                <div className='grid gap-4'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Bloom exposure lookup</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Bloom-index checks from a SHA-1 hash.</h1>
                    <p className='max-w-xl text-base leading-7 text-ui-muted'>
                        Paste a complete SHA-1 hash. Hanasand requests only the five-character prefix, then compares the returned range in your browser.
                    </p>
                </div>
                <PwnedPageClient />
            </div>
        </main>
    )
}
