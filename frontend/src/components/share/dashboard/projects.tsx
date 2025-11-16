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
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Shares</h1>
                <Link href='/s' className='flex gap-2 rounded-lg p-[3px] px-5 hover:outline-green-500/35 outline-1 outline-dark cursor-pointer hover:bg-green-500/20'>
                    <Plus />
                    <h1 className='font-semibold select-none'>Create</h1>
                </Link>
            </div>
            {typeof shares === 'string' 
                ? <h1 className='text-red-500 font-sm'>{shares}</h1>
                : (shares as Share[]).map((share) => <DashboardShare key={share.id} share={share} />)}
        </div>
    )
}
