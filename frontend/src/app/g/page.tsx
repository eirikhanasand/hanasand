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
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-[#f7f8fb] px-4 py-10 text-[#171a21] md:px-10'>
            <div className='grid w-full max-w-md gap-3'>
                <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-[0_20px_70px_rgba(26,35,55,0.10)]'>
                    <div className='grid gap-4'>
                        {pathDidNotExist && (
                            <ErrorNotice
                                compact
                                variant='info'
                                message={`The shortcut ${id ? `"/g/${id}"` : 'you opened'} does not exist yet.`}
                            />
                        )}
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-lg font-semibold text-[#171a21]'>
                                <LinkIcon className='h-5 w-5 text-[#3056d3]' />
                                {created ? 'Created shortcut' : 'Create shortcut'}
                            </div>
                            <p className='text-sm leading-6 text-[#596170]'>
                                {created ? 'Copy the shortcut and share it anywhere.' : 'Make a short Hanasand link for a URL you use often.'}
                            </p>
                        </div>
                        <LinkPageClient serverId={id} created={created} />
                    </div>
                </div>
                <div className='flex justify-end gap-2'>
                    {created && (
                        <Link href='/g' className='grid h-10 w-10 place-items-center rounded-lg border border-[#d8dee9] bg-white text-[#596170] transition hover:border-[#bdc7d5] hover:text-[#171a21]' aria-label='Create another shortcut'>
                            <ArrowLeft className='h-4 w-4' />
                        </Link>
                    )}
                    <Link href='/g/stats' className='grid h-10 w-10 place-items-center rounded-lg border border-[#d8dee9] bg-white text-[#596170] transition hover:border-[#bdc7d5] hover:text-[#171a21]' aria-label='Open shortcut statistics'>
                        <ChartColumn className='h-4 w-4' />
                    </Link>
                </div>
            </div>
        </section>
    )
}
