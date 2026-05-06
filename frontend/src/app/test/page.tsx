import ErrorNotice from '@/components/error/errorNotice'
import { ArrowLeft, ChartColumn, Flame } from 'lucide-react'
import LinkPageClient from './pageClient'
import Link from 'next/link'

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
        <div className='h-[90.5vh] w-full overflow-hidden px-3 py-3 sm:px-5 md:px-8 lg:px-10'>
            <div className='h-full w-full spawn overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] shadow-[0_22px_70px_rgba(0,0,0,0.22)]'>
                <div className='relative grid h-full min-h-0 w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 p-4 sm:p-5'>
                    {pathDidNotExist && (
                        <ErrorNotice compact variant='info' message={`The test '${id}' does not exist yet. Create a new run to get a shareable result link.`} />
                    )}
                    <div className='flex items-center justify-between gap-3 border-b border-white/8 pb-3'>
                        <div className='flex items-center gap-2'>
                            <Flame className='h-4 w-4 stroke-[#f07d33]' />
                            <h1 className='text-base font-medium text-bright/92'>{created ? 'Created test' : 'Create test'}</h1>
                        </div>
                        <Link href='/test/stats' className='group inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-medium text-bright/62 transition hover:bg-white/[0.07] hover:text-bright/82'>
                            <ChartColumn className='h-4 w-4 text-bright/56 group-hover:text-[#f07d33]' />
                            Results
                        </Link>
                    </div>
                    <div className='h-full min-h-0'>
                        <LinkPageClient serverId={id} created={created} />
                    </div>
                    {created && <Link href='/test' className='absolute bottom-4 right-4 grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-white/10 bg-white/[0.045] transition hover:bg-white/[0.07]'>
                        <ArrowLeft className='h-4 w-4 text-bright/70' />
                    </Link> }
                    <div className='grid min-w-0 place-items-center px-12'>
                        <p className='rounded-lg text-center text-xs text-bright/42'>
                            Always get permission before testing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
