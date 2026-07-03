import PwnedPageClient from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Password Exposure Check',
    description: 'Check exact password exposure with a local hash-prefix lookup.',
    path: '/pwned',
    keywords: ['password exposure', 'hash prefix', 'breach check'],
})

export default async function Page() {
    return (
        <main className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center'>
                <div className='grid gap-4'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Password exposure</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Exact-match checks without sending the password.</h1>
                    <p className='max-w-xl text-base leading-7 text-ui-muted'>
                        The browser hashes locally, sends only a five-character SHA-1 prefix, and compares the returned range on this device.
                    </p>
                </div>
                <PwnedPageClient />
            </div>
        </main>
    )
}
