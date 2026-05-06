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
        <div className='h-[90.5vh] w-full overflow-hidden px-3 py-3 sm:px-5 md:px-8 lg:px-12'>
            <div className='h-full w-full spawn overflow-hidden rounded-lg outline outline-dark'>
                <div className='relative grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-4 outline outline-dark p-4 sm:p-5'>
                    {pathDidNotExist && (
                        <div className='absolute top-2 w-full px-2'>
                            <h1 className='p-2 rounded-lg'>The test &apos;{id}&apos; does not exist yet! Feel free to create it 😃</h1>
                        </div>
                    )}
                    <div className='grid place-items-center'>
                        <div className='flex gap-2'>
                            <Flame className='stroke-[#f07d33]' />
                            <h1 className='text-xl'>{created ? 'Created test' : 'Create test'}</h1>
                        </div>
                    </div>
                    <div className='h-full min-h-0'>
                        <LinkPageClient serverId={id} created={created} />
                    </div>
                    {created && <Link href='/test' className='absolute bottom-4 right-16 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                        <ArrowLeft />
                    </Link> }
                    <div className='grid min-w-0 place-items-center px-12'>
                        <h1 className='rounded-lg text-superlight/90 text-center text-sm md:text-base'>
                            Always get permission before testing.
                        </h1>
                    </div>
                    <Link href='/test/stats' className='group absolute bottom-4 right-4 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                        <ChartColumn className='stroke-bright/80 group-hover:stroke-[#f07d33]' />
                    </Link>
                </div>
            </div>
        </div>
    )
}
