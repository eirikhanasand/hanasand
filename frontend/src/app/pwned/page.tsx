import PwnedPageClient from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import { Terminal } from 'lucide-react'
import CopyCodeButton from '../developers/copyCodeButton'

const hashCommand = 'printf %s \'HelloWorld\' | shasum'

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
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Has your password leaked?</h1>
                    <p className='max-w-xl text-base leading-7 text-ui-muted'>
                        Paste a SHA-1 hash. We check it against leaked passwords.
                    </p>
                </div>
                <PwnedPageClient />
                <section aria-labelledby='hash-command-title' className='min-w-0 overflow-hidden rounded-xl border border-ui-primary/25 bg-ui-panel lg:col-span-2'>
                    <div className='flex items-center justify-between gap-3 px-4 py-3 md:px-5'>
                        <div className='flex items-center gap-3'>
                            <Terminal className='h-5 w-5 shrink-0 text-ui-primary' aria-hidden='true' />
                            <div>
                                <h2 id='hash-command-title' className='text-sm font-semibold'>Create a hash locally</h2>
                                <p className='text-xs text-ui-muted'>macOS / Linux</p>
                            </div>
                        </div>
                        <CopyCodeButton value={hashCommand} />
                    </div>
                    <pre className='overflow-x-auto border-t border-ui-primary/20 bg-ui-primary/10 p-4 text-sm leading-6 text-ui-text md:p-5'><code>{hashCommand}</code></pre>
                </section>
            </div>
        </main>
    )
}
