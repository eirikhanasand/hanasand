import { ArrowLeft, ChartColumn, LinkIcon } from 'lucide-react'
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
            <div className='grid w-full spawn rounded-lg overflow-hidden'>
                <div className='w-full h-full bg-light p-4 space-y-4 relative'>
                    {pathDidNotExist && (
                        <div className='w-full bg-dark rounded-lg p-2 text-gray-200'>
                            <h1>The shortcut &apos;{id}&apos; does not exist yet! Feel free to create it 😃</h1>
                        </div>
                    )}
                    <div className={!pathDidNotExist ? 'h-full grid place-items-center' : ''}>
                        <div className='flex flex-col items-center gap-4'>
                            <div className='flex gap-2'>
                                <LinkIcon />
                                <h1 className='text-xl'>{created ? 'Created link' : 'Create link'}</h1>
                            </div>
                            <LinkPageClient serverId={id} created={created} />
                        </div>
                    </div>
                    {created && <Link href='/g' className='absolute bottom-0 right-16 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                        <ArrowLeft />
                    </Link> }
                    <Link href='/g/stats' className='absolute bottom-4 right-4 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                        <ChartColumn />
                    </Link> 
                </div>
            </div>
        </div>
    )
}
