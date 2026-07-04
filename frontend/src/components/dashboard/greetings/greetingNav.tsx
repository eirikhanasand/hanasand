import parseCookie from '@/utils/cookies/parseCookie'
import { FileWarning, Inbox, SquareChartGantt } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'

export default async function GreetingNav({ text, id }: { text: string, id: string }) {
    const Cookies = await cookies()
    const rolesCookie = Cookies.get('roles')?.value
    const roles = parseCookie<Array<Role | string>>(rolesCookie, [])
    const isAdmin = roles.some((role) => typeof role === 'string' ? role.includes('admin') : role.id?.includes('admin'))

    return (
        <div className='flex w-full items-center justify-between rounded-lg'>
            <h1 className='flex-1 text-lg font-semibold md:text-2xl'>{text}</h1>
            <div className='hidden md:flex gap-2'>
                {isAdmin && <div className='group grid h-fit w-fit cursor-pointer gap-2 rounded-lg border border-ui-border px-2 py-1'>
                    <Link href='/dashboard/management' className='flex justify-between px-9 items-center gap-2'>
                        <SquareChartGantt className='h-5 w-5 text-ui-muted group-hover:text-ui-primary' />
                        <h1 className='font-semibold text-base self-center'>Management</h1>
                    </Link>
                </div>}
                {isAdmin && <div className='group grid h-fit w-fit cursor-pointer gap-2 rounded-lg border border-ui-border px-2 py-1'>
                    <Link href='/dashboard/logs' className='flex justify-between px-9 items-center gap-2'>
                        <FileWarning className='h-5 w-5 text-ui-muted group-hover:text-ui-primary' />
                        <h1 className='font-semibold text-base self-center'>Logs</h1>
                    </Link>
                </div>}
                <div className='group grid h-fit w-fit cursor-pointer gap-2 rounded-lg border border-ui-border px-2 py-1'>
                    <Link href='/dashboard/mail' className='flex justify-between px-9 items-center gap-2'>
                        <Inbox className='h-5 w-5 text-ui-muted group-hover:text-ui-primary' />
                        <h1 className='font-semibold text-base self-center'>Mail</h1>
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
