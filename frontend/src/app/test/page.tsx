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
        <div className='grid min-h-[90.5vh] w-full place-items-center px-4 py-6 sm:px-6 md:px-10 lg:px-16'>
            <div className='grid w-full max-w-6xl spawn rounded-lg overflow-hidden outline outline-dark'>
                <div className='relative grid w-full gap-6 outline outline-dark p-4 sm:p-6'>
                    {pathDidNotExist && (
                        <div className='absolute top-2 w-full px-2'>
                            <h1 className='p-2 rounded-lg'>The test &apos;{id}&apos; does not exist yet! Feel free to create it 😃</h1>
                        </div>
                    )}
                    <div className={!pathDidNotExist ? 'grid place-items-center' : ''}>
                        <div className='flex flex-col items-center gap-4'>
                            <div className='flex gap-2'>
                                <Flame className='stroke-[#e25822]' />
                                <h1 className='text-xl'>{created ? 'Created test' : 'Create test'}</h1>
                            </div>
                            <LinkPageClient serverId={id} created={created} />
                        </div>
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
                        <ChartColumn className='stroke-bright/80 group-hover:stroke-[#e25822]' />
                    </Link>
                </div>
            </div>
        </div>
    )
}
