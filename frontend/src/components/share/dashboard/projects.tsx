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
                    <h2 className='text-base font-medium text-bright/90'>Shares</h2>
                    <p className='mt-1 text-xs text-bright/38'>
                        {typeof shares === 'string' ? 'Unavailable' : `${shares.length} shared spaces`}
                    </p>
                </div>
                <Link href='/s' className='inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-bright/70 transition hover:bg-white/9 hover:text-bright'>
                    <Plus className='h-4 w-4' />
                    <span>Create</span>
                </Link>
            </div>
            <div className='grid gap-1'>
                {typeof shares === 'string'
                    ? <ErrorNotice compact message={shares} />
                    : (shares as Share[]).length
                        ? (shares as Share[]).map((share) => <DashboardShare key={share.id} share={share} />)
                        : <p className='text-sm text-bright/42'>No shares yet.</p>}
            </div>
        </DashboardPanel>
    )
}
