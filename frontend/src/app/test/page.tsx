import ErrorNotice from '@/components/error/errorNotice'
import { ArrowLeft, ChartColumn, Flame } from 'lucide-react'
import LinkPageClient from './pageClient'
import Link from 'next/link'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Service Check',
    description: 'Create a permitted endpoint check and share a Hanasand result link.',
    path: '/test',
    keywords: ['service check', 'endpoint test', 'hanasand'],
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
        <div className='enterprise-console h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-[#f7f8fb] px-3 py-3 text-[#171a21] sm:px-5 md:px-8 lg:px-10'>
            <div className='h-full w-full spawn overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-[0_20px_70px_rgba(26,35,55,0.10)]'>
                <div className='relative grid h-full min-h-0 w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 p-4 sm:p-5'>
                    {pathDidNotExist && (
                        <ErrorNotice compact variant='info' message={`The test '${id}' does not exist yet. Create a new run to get a shareable result link.`} />
                    )}
                    <div className='flex items-center justify-between gap-3 border-b border-[#e0e5ed] pb-3'>
                        <div className='flex items-center gap-2'>
                            <Flame className='h-4 w-4 stroke-[#3056d3]' />
                            <h1 className='text-base font-semibold text-[#171a21]'>{created ? 'Created service check' : 'Create service check'}</h1>
                        </div>
                        <Link href='/test/stats' className='group inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:border-[#bdc7d5]'>
                            <ChartColumn className='h-4 w-4 text-[#667085] group-hover:text-[#3056d3]' />
                            Results
                        </Link>
                    </div>
                    <div className='h-full min-h-0'>
                        <LinkPageClient serverId={id} created={created} />
                    </div>
                    {created && <Link href='/test' className='absolute bottom-4 right-4 grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-[#d8dee9] bg-white transition hover:border-[#bdc7d5]'>
                        <ArrowLeft className='h-4 w-4 text-[#344054]' />
                    </Link> }
                    <div className='grid min-w-0 place-items-center px-12'>
                        <p className='rounded-lg text-center text-xs text-[#667085]'>
                            Always get permission before testing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
