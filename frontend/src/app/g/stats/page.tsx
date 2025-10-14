import { ChartColumn, LinkIcon } from 'lucide-react'
import Link from 'next/link'
import LinkStatsPageClient from './pageClient'

export default function Page() {
    return (
        <div className='min-h-[93.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-60 md:px-100 grid gap-2 place-items-center'>
            <div className='grid w-full spawn rounded-lg overflow-hidden'>
                <LinkStatsPageClient />
            </div>
        </div>
    )
}
