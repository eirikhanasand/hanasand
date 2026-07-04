import { Cog, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function MobileNav({ id }: { id: string }) {
    return (
        <div className='flex w-full gap-2 md:hidden'>
            <div className='group grid h-fit w-full cursor-pointer gap-2 rounded-lg border border-ui-border px-2 py-1'>
                <Link href='/dashboard/traffic' className='flex w-full items-center justify-between gap-2'>
                    <Cog className='h-5 w-5 text-ui-muted group-hover:text-ui-text' />
                    <h1 className='font-semibold text-base self-center'>System</h1>
                </Link>
            </div>
            <div className='group grid h-fit w-full cursor-pointer gap-2 rounded-lg border border-ui-border px-2 py-1'>
                <Link href='/dashboard/traffic' className='flex w-full items-center justify-between gap-2'>
                    <TrendingUp className='h-5 w-5 text-ui-muted group-hover:text-ui-primary' />
                    <h1 className='font-semibold text-base self-center'>Traffic</h1>
                </Link>
            </div>
            <div className='grid h-fit w-full gap-2 rounded-lg border border-ui-border px-2 py-1'>
                <Link href={`/profile/${id}`} className='group flex w-full cursor-pointer items-center justify-between'>
                    <div className='user-icon' />
                    <h1 className='font-semibold text-base self-center'>Profile</h1>
                </Link>
            </div>
        </div>
    )
}
