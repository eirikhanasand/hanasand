import { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import parseCookie from '@/utils/cookies/parseCookie'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'
import ImpersonationBanner from '@/components/impersonation/impersonationBanner'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    const impersonatingId = cookieStore.get('impersonating_id')?.value || headerStore.get('x-impersonating-id') || ''
    const impersonatingName = cookieStore.get('impersonating_name')?.value || headerStore.get('x-impersonating-name') || ''
    const rolesCookie = cookieStore.get('roles')?.value
    const roles = parseCookie<Array<Role | string>>(rolesCookie, [])
    const isAdmin = roles.some((role) => typeof role === 'string' ? role.includes('admin') : role.id?.includes('admin'))

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    return (
        <div className='h-full px-2 pb-2'>
            <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start'>
                <DashboardSidebar id={id} isAdmin={isAdmin} />
                <div className='min-h-0 min-w-0 overflow-auto'>
                    {impersonatingId && <ImpersonationBanner id={impersonatingId} name={impersonatingName} />}
                    {children}
                </div>
            </div>
        </div>
    )
}
