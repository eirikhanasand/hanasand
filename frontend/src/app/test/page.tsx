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
        <div className='min-h-[93.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-[15rem] md:px-40 lg:px-100 grid gap-2 place-items-center'>
            <div className='grid w-full spawn rounded-lg overflow-hidden glow-orange'>
                <div className='w-full h-full bg-light p-4 space-y-4 relative grid place-items-center'>
                    {pathDidNotExist && (
                        <div className='w-full bg-dark rounded-lg p-2 text-gray-200'>
                            <h1>The test &apos;{id}&apos; does not exist yet! Feel free to create it 😃</h1>
                        </div>
                    )}
                    <div className={!pathDidNotExist ? 'h-full grid place-items-center' : ''}>
                        <div className='flex flex-col items-center gap-4'>
                            <div className='flex gap-2'>
                                <Flame className='stroke-[#e25822]' />
                                <h1 className='text-xl'>{created ? 'Created test' : 'Create test'}</h1>
                            </div>
                            <LinkPageClient serverId={id} created={created} />
                        </div>
                    </div>
                    {created && <Link href='/test' className='absolute bottom-0 right-16 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                        <ArrowLeft />
                    </Link> }
                    <div className='-ml-4 flex w-full absolute bottom-0 p-4'>
                        <div className='w-12' />
                        <h1 className='flex-1 rounded-lg w-full grid place-items-center text-superlight text-center md:text-left text-sm md:text-base'>
                            Only test websites you have permission to test.
                        </h1>
                    </div>
                    <Link href='/test/stats' className='absolute bottom-4 right-4 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                        <ChartColumn />
                    </Link> 
                </div>
            </div>
        </div>
    )
}
