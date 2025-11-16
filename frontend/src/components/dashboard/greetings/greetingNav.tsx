import { SquareChartGantt } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'

export default async function GreetingNav({ text, id }: { text: string, id: string }) {
    const Cookies = await cookies()
    const roles = Cookies.get('roles')?.value

    return (
        <div className='flex w-full rounded-lg justify-between items-center'>
            <h1 className='text-lg md:text-2xl font-semibold flex-1'>{text}</h1>
            <div className='hidden md:flex gap-2'>
                <div className='grid h-fit w-fit px-2 py-1 outline-1 outline-dark rounded-lg gap-2 group cursor-pointer'>
                    <Link href='/dashboard/management' className='flex justify-between px-9 items-center gap-2'>
                        <SquareChartGantt className='w-5 h-5 group-hover:stroke-[#e25822]' />
                        <h1 className='font-semibold text-base self-center'>Management</h1>
                    </Link>
                </div>
                <div className='grid h-fit w-fit px-2 py-1 outline-1 outline-dark rounded-lg gap-2'>
                    <Link href={`/profile/${id}`} className='flex justify-between px-10 group cursor-pointer items-center'>
                        <div className='user-icon' />
                        <h1 className='font-semibold text-base self-center'>Profile</h1>
                    </Link>
                </div>
            </div>
        </div>
    )
}
