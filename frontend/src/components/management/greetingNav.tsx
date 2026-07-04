import { Cog, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function GreetingNav({ text, id }: { text: string, id: string }) {
    return (
        <div className='flex w-full rounded-lg justify-between items-center'>
            <h1 className='flex-1 text-lg font-semibold md:text-2xl'>{text}</h1>
            <div className='hidden md:flex gap-2'>
                <div className='group grid h-fit w-fit cursor-pointer gap-2 rounded-lg border border-ui-border px-2 py-1'>
                    <Link href='/dashboard/system' className='flex justify-between px-9 items-center gap-2'>
                        <Cog className='h-5 w-5 text-ui-muted group-hover:text-ui-text' />
                        <h1 className='font-semibold text-base self-center'>System</h1>
                    </Link>
                </div>
                <div className='group grid h-fit w-fit cursor-pointer gap-2 rounded-lg border border-ui-border px-2 py-1'>
                    <Link href='/dashboard/traffic' className='flex justify-between px-9 items-center gap-2'>
                        <TrendingUp className='h-5 w-5 text-ui-muted group-hover:text-ui-primary' />
                        <h1 className='font-semibold text-base self-center'>Traffic</h1>
                    </Link>
                </div>
                <div className='grid h-fit w-fit gap-2 rounded-lg border border-ui-border px-2 py-1'>
                    <Link href={`/profile/${id}`} className='flex justify-between px-10 group cursor-pointer items-center'>
                        <div className='user-icon' />
                        <h1 className='font-semibold text-base self-center'>Profile</h1>
                    </Link>
                </div>
            </div>
        </div>
    )
}
