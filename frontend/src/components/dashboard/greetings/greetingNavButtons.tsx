import { SquareChartGantt } from 'lucide-react'
import Link from 'next/link'

export default function GreetingNavButtons({ id }: { id: string }) {
    return (
        <div className='flex md:hidden gap-2 w-full'>
            <div className='grid h-fit px-2 py-1 outline-1 outline-dark w-full rounded-lg gap-2 group cursor-pointer'>
                <Link href='/dashboard/management' className='flex justify-between w-full items-center gap-2'>
                    <SquareChartGantt className='w-5 h-5 group-hover:stroke-[#e25822]' />
                    <h1 className='font-semibold text-base self-center'>Management</h1>
                </Link>
            </div>
            <div className='grid h-fit px-2 py-1 outline-1 outline-dark w-full rounded-lg gap-2'>
                <Link href={`/profile/${id}`} className='flex justify-between w-full group cursor-pointer items-center'>
                    <div className='user-icon' />
                    <h1 className='font-semibold text-base self-center'>Profile</h1>
                </Link>
            </div>
        </div>
    )
}
