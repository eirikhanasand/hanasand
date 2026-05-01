import Link from 'next/link'
import { Plus } from 'lucide-react'
import DashboardShare from './dashboardShare'
import { getUserShares } from '@/utils/share/getUserShares'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Shares() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const shares = await getUserShares({ id, token })

    return (
        <div className='grid h-fit w-full gap-4 rounded-2xl p-4 outline outline-dark'>
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <h1 className='text-lg font-semibold'>Shares</h1>
                    <p className='mt-1 text-sm text-bright/45'>Open an existing workspace or create a new one.</p>
                </div>
                <Link href='/s' className='flex gap-2 rounded-xl px-4 py-2.5 outline outline-dark transition-colors hover:bg-green-500/20 hover:outline-green-500/35'>
                    <Plus />
                    <h1 className='select-none font-semibold'>Create</h1>
                </Link>
            </div>
            {typeof shares === 'string'
                ? <h1 className='text-red-500 font-sm'>{shares}</h1>
                : (shares as Share[]).map((share) => <DashboardShare key={share.id} share={share} />)}
        </div>
    )
}
