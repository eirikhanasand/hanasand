import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import parseCookie from '@/utils/cookies/parseCookie'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    const rolesCookie = cookieStore.get('roles')?.value
    const roles = parseCookie<Role[]>(rolesCookie, [])
    const isAdmin = roles.some((role) => role.id.includes('admin'))

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    return (
        <div className='h-full px-2 pb-2'>
            <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start'>
                <DashboardSidebar id={id} isAdmin={isAdmin} />
                <div className='min-h-0 min-w-0 overflow-auto'>{children}</div>
            </div>
        </div>
    )
}
