'use client'

import { hasAppSidebar, isInternalAppPath } from '@/utils/routes/appRoutes'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Footer from '@/components/footer/footer'
import { useMobileNavigation } from './mobileNavigation'
import isSharePath from '@/utils/routes/isSharePath'
import isPublicProductPath from '@/utils/routes/isPublicProductPath'

export default function RouteFrame({ children, serverPath, token, sidebar, banner }: { children: ReactNode, serverPath: string, token: boolean, sidebar: ReactNode, banner: ReactNode }) {
    const mobile = useMobileNavigation()
    const pathname = usePathname() || serverPath
    const isShare = isSharePath(pathname)
    const isDashboard = isInternalAppPath(pathname)
    const showSidebar = Boolean(sidebar) && hasAppSidebar(pathname)
    const isProfile = pathname.startsWith('/profile')
    const isOrganizations = pathname.startsWith('/organizations')
    const isAiWorkbench = pathname.startsWith('/ai') && pathname !== '/ai/window'
    const isPublicProduct = isPublicProductPath(pathname)
    const isLoggedInTi = token && (pathname === '/ti' || pathname.startsWith('/ti/'))
    const isAppSurface = showSidebar || isDashboard || isLoggedInTi || (!isPublicProduct && (isShare || pathname.startsWith('/ai') || isDashboard || isProfile || isOrganizations))

    const frameSizing = isAppSurface
        ? 'mt-16 h-[calc(100vh-4rem)]'
        : isPublicProduct
            ? 'mt-[4.5rem] h-[calc(100vh-4.5rem)]'
            : 'mt-[8.25vh] h-[91.75vh] md:mt-[9.5vh] md:h-[90.5vh]'

    return (
        <div className={`enterprise-theme relative z-10 ${frameSizing} w-full overflow-auto`}>
            <main className={`w-full ${isAppSurface ? 'h-full' : isPublicProduct ? 'min-h-full' : 'min-h-[90.5vh] pt-3 md:pt-0'}`}>
                {showSidebar ? (
                    <div className='h-full min-h-0 bg-ui-canvas px-2 pb-2 text-ui-text'>
                        <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[auto_minmax(0,1fr)]'>
                            {mobile.open && <button type='button' aria-label='Close navigation backdrop' onClick={mobile.close}
                                className='fixed inset-x-0 bottom-0 top-16 z-100 bg-black/30 lg:hidden' />}
                            <div id='mobile-navigation' onClick={event => {
                                if ((event.target as HTMLElement).closest('a[href]')) mobile.close()
                            }} className={`${mobile.open ? 'block' : 'hidden'} fixed inset-x-2 top-18 z-101 max-h-[calc(100dvh-5rem)] overflow-y-auto lg:contents`}>
                                {sidebar}
                            </div>
                            <div className='min-h-0 min-w-0 overflow-y-auto'>{banner}{children}</div>
                        </div>
                    </div>
                ) : children}
            </main>
            {isAppSurface && !isAiWorkbench ? null : <Footer />}
        </div>
    )
}
