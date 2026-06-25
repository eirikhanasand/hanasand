import { ReactNode } from 'react'
import { cookies } from 'next/headers'
import parseCookie from '@/utils/cookies/parseCookie'
import DashboardSidebar from './dashboardSidebar'

export default async function ConsoleRouteShell({ children }: { children: ReactNode }) {
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value

    if (!id || !token) {
        return children
    }

    const rolesCookie = cookieStore.get('roles')?.value
    const roles = parseCookie<Array<Role | string>>(rolesCookie, [])
    const roleIds = roles.map((role) => typeof role === 'string' ? role : role.id || '')
    const hasRole = (roleId: string) => roleIds.includes(roleId)
    const isAdmin = hasRole('administrator') || hasRole('admin')
    const canManageSystem = isAdmin || hasRole('system_admin')
    const canManageContent = isAdmin || hasRole('content_admin')

    return (
        <div className='h-full min-h-0 overflow-hidden bg-[#f7f8fb] px-2 pb-2 text-[#171a21]'>
            <div className='grid h-full min-h-0 gap-2 overflow-hidden lg:grid-cols-[auto_minmax(0,1fr)]'>
                <DashboardSidebar
                    id={id}
                    isAdmin={isAdmin}
                    canManageSystem={canManageSystem}
                    canManageContent={canManageContent}
                />
                <div className='min-h-0 min-w-0 overflow-auto overscroll-contain'>
                    {children}
                </div>
            </div>
        </div>
    )
}
