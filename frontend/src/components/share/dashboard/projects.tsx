import Link from 'next/link'
import { Plus } from 'lucide-react'
import DashboardShare from './dashboardShare'
import { getUserShares } from '@/utils/share/getUserShares'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPanel } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'

export default async function Shares() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const shares = await getUserShares({ id, token })

    return (
        <DashboardPanel className='grid min-h-42 content-start gap-3 p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-[#171a21]'>Code shares</h2>
                    <p className='mt-1 text-sm text-[#596170]'>
                        {typeof shares === 'string' ? 'Unavailable' : `${shares.length} code share${shares.length === 1 ? '' : 's'}`}
                    </p>
                </div>
                <Link prefetch={false} href='/s' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#364152] transition hover:bg-[#f2f5f9]'>
                    <Plus className='h-4 w-4' />
                    <span>Create share</span>
                </Link>
            </div>
            <div className='grid gap-1'>
                {typeof shares === 'string'
                    ? <ErrorNotice compact message={shares} />
                    : (shares as Share[]).length
                        ? (shares as Share[]).map((share) => <DashboardShare key={share.id} share={share} />)
                        : <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#596170]'>No code shares yet. Create a file, snippet, or project workspace when you need a shareable code surface.</p>}
            </div>
        </DashboardPanel>
    )
}
