import { NAVIGATION_COOKIE, readNavigationPreferences } from '@/utils/layout/navigationPreferences'
import parseCookie from '@/utils/cookies/parseCookie'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'
import ImpersonationBanner from '@/components/impersonation/impersonationBanner'
import { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import './globals.css'
import Header from '@/components/header/header'
import DetachedBoxHost from '@/components/box/detachedBoxHost'
import RouteFrame from '@/components/layout/routeFrame'
export { default as metadata } from './metadata'
export { default as viewport } from './metadata'

export default async function layout({ children }: { children: ReactNode }) {
    const Cookies = await cookies()
    const Headers = await headers()
    const token = Boolean(Cookies.get('access_token')?.value) || false
    const themeCookie = Cookies.get('theme')?.value
    const theme = themeCookie === 'dark' ? 'dark' : 'light'
    const path = Headers.get('x-current-path') || ''
    const id = Cookies.get('id')?.value || ''
    const roles = parseCookie<Array<Role | string>>(Cookies.get('roles')?.value, [])
    const roleIds = roles.flatMap(role => {
        if (typeof role === 'string') return [role]
        const legacy = role as Role & { role_id?: string, role?: string }
        return [legacy.id, legacy.role_id, legacy.role].filter(Boolean)
    })
    const isAdmin = roleIds.includes('administrator') || roleIds.includes('admin')
    const canManageSystem = isAdmin || roleIds.includes('system_admin')
    const canManageContent = isAdmin || roleIds.includes('content_admin')
    const canReviewIntel = canManageSystem || roleIds.includes('analyst') || roleIds.includes('owner')
    const initialMode = Cookies.get('dashboard_view_mode')?.value === 'compact' ? 'compact' : 'normal'
    const initialPreferences = readNavigationPreferences(Cookies.get(NAVIGATION_COOKIE)?.value, id)
    const impersonatingId = Cookies.get('impersonating_id')?.value || Headers.get('x-impersonating-id') || ''
    const impersonatingName = Cookies.get('impersonating_name')?.value || Headers.get('x-impersonating-name') || ''

    return (
        <html lang='en' className={theme}>
            <body className='h-full w-full max-h-screen max-w-screen overflow-hidden'>
                <div className='site-atmosphere' />
                <Header token={token} path={path} initialMode={initialMode} />
                <DetachedBoxHost />
                <RouteFrame serverPath={path} token={token}
                    sidebar={id && token ? <DashboardSidebar initialPreferences={initialPreferences} initialMode={initialMode} id={id} isAdmin={isAdmin} canManageSystem={canManageSystem} canManageContent={canManageContent} canReviewIntel={canReviewIntel} /> : null}
                    banner={impersonatingId ? <ImpersonationBanner id={impersonatingId} name={impersonatingName} /> : null}>
                    {children}
                </RouteFrame>
            </body>
        </html>
    )
}
