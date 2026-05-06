import type { Metadata } from 'next'
import { ArrowLeft, ChartColumn, LinkIcon } from 'lucide-react'
import LinkPageClient from './pageClient'
import Link from 'next/link'
import { buildRouteMetadata } from '../seo'
import ErrorNotice from '@/components/error/errorNotice'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Links',
    description: 'Create and manage shortcut links on Hanasand.',
    path: '/g',
    keywords: ['links', 'shortcuts', 'hanasand'],
})

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const pathDidNotExist = params.null
    const created = Array.isArray(params.created) ? params.created[0] : params.created
    const id = Array.isArray(params.id) ? params.id[0] : params.id

    return (
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='grid w-full max-w-md gap-3'>
                <div className='rounded-xl border border-white/10 bg-dark/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-md'>
                    <div className='grid gap-4'>
                        {pathDidNotExist && (
                            <ErrorNotice
                                compact
                                variant='info'
                                message={`The shortcut ${id ? `"/g/${id}"` : 'you opened'} does not exist yet.`}
                            />
                        )}
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-lg font-semibold text-bright/88'>
                                <LinkIcon className='h-5 w-5 text-[#f0a17a]' />
                                {created ? 'Created shortcut' : 'Create shortcut'}
                            </div>
                            <p className='text-sm leading-6 text-bright/45'>
                                {created ? 'Copy the shortcut and share it anywhere.' : 'Make a short Hanasand link for a URL you use often.'}
                            </p>
                        </div>
                        <LinkPageClient serverId={id} created={created} />
                    </div>
                </div>
                <div className='flex justify-end gap-2'>
                    {created && (
                        <Link href='/g' className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-bright/58 transition hover:bg-white/7 hover:text-bright' aria-label='Create another shortcut'>
                            <ArrowLeft className='h-4 w-4' />
                        </Link>
                    )}
                    <Link href='/g/stats' className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-bright/58 transition hover:bg-white/7 hover:text-bright' aria-label='Open shortcut statistics'>
                        <ChartColumn className='h-4 w-4' />
                    </Link>
                </div>
            </div>
        </section>
    )
}
