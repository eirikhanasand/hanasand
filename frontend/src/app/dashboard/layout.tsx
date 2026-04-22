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
        <div className='px-3 pb-6 sm:px-5 md:px-10 md:pb-8 lg:px-14'>
            <div className='grid gap-3 sm:gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-5'>
                <DashboardSidebar id={id} isAdmin={isAdmin} />
                <div className='min-w-0'>{children}</div>
            </div>
        </div>
    )
}
