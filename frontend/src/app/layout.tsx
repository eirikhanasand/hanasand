import WorkspaceProvider from '@/components/organizations/workspaceProvider'
import { readWorkspace, WORKSPACE_COOKIE } from '@/utils/organizations/workspace'
import { NAVIGATION_COOKIE, readNavigationPreferences } from '@/utils/layout/navigationPreferences'
import { thesisNavigationFromDocument } from '@/utils/layout/thesisNavigationData'
import { loadThesisForRender } from '@/utils/thesis'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'
import ImpersonationBanner from '@/components/impersonation/impersonationBanner'
import { ReactNode, Suspense, type ComponentProps } from 'react'
import { cookies, headers } from 'next/headers'
import './globals.css'
import Header from '@/components/header/header'
import DetachedBoxHost from '@/components/box/detachedBoxHost'
import RouteFrame from '@/components/layout/routeFrame'
import MobileNavigation from '@/components/layout/mobileNavigation'
import fetchUser from '@/utils/users/fetchUser'
export { default as metadata } from './metadata'
export { viewport } from './metadata'

export default async function layout({ children }: { children: ReactNode }) {
    const Cookies = await cookies()
    const Headers = await headers()
    const accessToken = Cookies.get('access_token')?.value || ''
    const token = Boolean(accessToken)
    const themeCookie = Cookies.get('theme')?.value
    const theme = themeCookie === 'light' ? 'light' : 'dark'
    const path = Headers.get('x-current-path') || ''
    const id = Cookies.get('id')?.value || ''
    const tokenValue = Cookies.get('access_token')?.value || ''
    const username = token && id && tokenValue ? id : ''
    const initialMode = Cookies.get('dashboard_view_mode')?.value === 'compact' ? 'compact' : 'normal'
    const initialPreferences = readNavigationPreferences(Cookies.get(NAVIGATION_COOKIE)?.value, id)
    const impersonatingId = Cookies.get('impersonating_id')?.value || Headers.get('x-impersonating-id') || ''
    const impersonatingName = Cookies.get('impersonating_name')?.value || Headers.get('x-impersonating-name') || ''
    const sidebarProps = {
        initialPreferences,
        initialMode,
        id,
        thesisSheets: [],
        hasHanasandOrganization: false,
    } satisfies ComponentProps<typeof DashboardSidebar>

    return (
        <html lang='en' className={theme}>
            <body className='h-full w-full max-h-screen max-w-screen overflow-hidden'>
                <div className='site-atmosphere' />
                <WorkspaceProvider initial={readWorkspace(Cookies.get(WORKSPACE_COOKIE)?.value, impersonatingId || id)} enabled={token} serviceAccount={id.startsWith('svc_')}>
                    <MobileNavigation enabled={Boolean(id && token)}>
                        {token && id && tokenValue
                            ? <Suspense fallback={<Header token={token} id={id} username={id} path={path} />}>
                                <AuthorizedHeader id={id} tokenValue={tokenValue} path={path} />
                            </Suspense>
                            : <Header token={token} id={id} username={username} path={path} />}
                        <DetachedBoxHost />
                        <RouteFrame serverPath={path} token={token}
                            sidebar={id && token ? <Suspense fallback={<DashboardSidebar {...sidebarProps} canManageOrganizations={false} canViewInternalPages={false} />}>
                                <AuthorizedSidebar {...sidebarProps} />
                            </Suspense> : null}
                            banner={impersonatingId ? <ImpersonationBanner id={impersonatingId} name={impersonatingName} /> : null}>
                            {children}
                        </RouteFrame>
                    </MobileNavigation>
                </WorkspaceProvider>
            </body>
        </html>
    )
}

async function initialThesisNavigation(token: string, id: string) {
    if (!token || !id || id.startsWith('svc_')) return { hasAccess: false, sheets: [] }
    try {
        const result = await loadThesisForRender(token, id)
        if (result.state !== 'loaded') return { hasAccess: false, sheets: [] }
        return { hasAccess: true, sheets: thesisNavigationFromDocument(result.document) }
    } catch {
        return { hasAccess: false, sheets: [] }
    }
}

async function AuthorizedHeader({ id, tokenValue, path }: { id: string, tokenValue: string, path: string }) {
    const userProfile = await fetchUser(id, { id, token: tokenValue })
    return <Header token id={id} username={userProfile?.username || id} path={path} />
}

async function AuthorizedSidebar(props: ComponentProps<typeof DashboardSidebar>) {
    const store = await cookies()
    const thesisNavigation = await initialThesisNavigation(store.get('access_token')?.value || '', store.get('id')?.value || '')
    return <DashboardSidebar {...props} thesisSheets={thesisNavigation.sheets} hasHanasandOrganization={thesisNavigation.hasAccess} />
}
