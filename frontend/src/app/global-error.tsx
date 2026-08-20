'use client'

import { AlertTriangle, ArrowLeft, Home, RefreshCcw, Search } from 'lucide-react'
import Link from 'next/link'
import BrandLogo from '@/components/brand/brandLogo'
import './globals.css'

export default function GlobalError({ reset }: { error: Error & { digest?: string }, reset: () => void }) {
    return (
        <html lang='en'>
            <body className='min-h-screen bg-ui-canvas text-ui-text'>
                <main className='min-h-screen px-4 py-6 sm:px-8 sm:py-10'>
                    <div className='mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col'>
                        <BrandLogo />
                        <section className='my-auto grid gap-8 py-16 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-12'>
                            <div className='grid h-20 w-20 place-items-center rounded-2xl border border-ui-danger/30 bg-ui-danger/10 text-ui-danger'>
                                <AlertTriangle className='h-9 w-9' />
                            </div>
                            <div className='max-w-2xl'>
                                <p className='text-sm font-semibold uppercase tracking-[0.16em] text-ui-primary'>Hanasand workspace</p>
                                <h1 className='mt-3 text-4xl font-semibold tracking-tight md:text-6xl'>Something went wrong.</h1>
                                <p className='mt-4 text-base leading-7 text-ui-muted md:text-lg'>
                                    This page hit an unexpected problem. Try again, or use one of the links below to continue working in Hanasand.
                                </p>
                                <div className='mt-7 flex flex-wrap gap-3'>
                                    <button type='button' onClick={reset} className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                        <RefreshCcw className='h-4 w-4' />
                                        Try again
                                    </button>
                                    <Link href='/dashboard' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                        <Home className='h-4 w-4' />
                                        Dashboard
                                    </Link>
                                </div>
                            </div>
                        </section>
                        <nav aria-label='Recovery navigation' className='flex flex-wrap gap-x-5 gap-y-3 border-t border-ui-border pt-5 text-sm font-semibold'>
                            <Link href='/' className='inline-flex items-center gap-1 text-ui-muted hover:text-ui-text'><ArrowLeft className='h-4 w-4' />Home</Link>
                            <Link href='/ti' className='inline-flex items-center gap-1 text-ui-muted hover:text-ui-text'><Search className='h-4 w-4' />Threat search</Link>
                            <Link href='/dwm' className='text-ui-muted hover:text-ui-text'>Dark web monitoring</Link>
                            <Link href='/support' className='text-ui-muted hover:text-ui-text'>Support</Link>
                        </nav>
                    </div>
                </main>
            </body>
        </html>
    )
}
