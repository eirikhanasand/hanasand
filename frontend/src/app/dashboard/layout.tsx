import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import parseCookie from '@/utils/cookies/parseCookie'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'
import ImpersonationBanner from '@/components/impersonation/impersonationBanner'

export const metadata: Metadata = {
    title: {
        default: 'Dashboard | Hanasand',
        template: '%s | Hanasand',
    },
    description: 'Customer dashboard for company exposure monitoring, threat search, webhook alerts, and API access.',
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    const impersonatingId = cookieStore.get('impersonating_id')?.value || headerStore.get('x-impersonating-id') || ''
    const impersonatingName = cookieStore.get('impersonating_name')?.value || headerStore.get('x-impersonating-name') || ''
    const rolesCookie = cookieStore.get('roles')?.value
    const roles = parseCookie<Array<Role | string>>(rolesCookie, [])
    const roleIds = roles.map((role) => typeof role === 'string' ? role : role.id || '')
    const hasRole = (roleId: string) => roleIds.includes(roleId)
    const isAdmin = hasRole('administrator') || hasRole('admin')
    const canManageSystem = isAdmin || hasRole('system_admin')
    const canManageContent = isAdmin || hasRole('content_admin')
    const canReviewIntel = canManageSystem || hasRole('analyst') || hasRole('owner')

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    return (
        <div className='min-h-dvh bg-ui-canvas px-2 pb-2 text-ui-text'>
            <div className='grid min-h-dvh gap-2 lg:grid-cols-[auto_minmax(0,1fr)]'>
                <DashboardSidebar
                    id={id}
                    isAdmin={isAdmin}
                    canManageSystem={canManageSystem}
                    canManageContent={canManageContent}
                    canReviewIntel={canReviewIntel}
                />
                <div className='min-w-0'>
                    {impersonatingId && <ImpersonationBanner id={impersonatingId} name={impersonatingName} />}
                    {children}
                </div>
            </div>
        </div>
    )
}
