'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Footer from '@/components/footer/footer'
import BackgroundSketches from '@/components/background/backgroundSketches'
import isSharePath from '@/utils/routes/isSharePath'

export default function RouteFrame({ children, serverPath }: { children: ReactNode, serverPath: string }) {
    const pathname = usePathname() || serverPath
    const isShare = isSharePath(pathname)
    const isDashboard = pathname.startsWith('/dashboard')
    const isProfile = pathname.startsWith('/profile')
    const isAppSurface = isShare || pathname.startsWith('/ai') || isDashboard || isProfile
    const isMarketing = pathname === '/' || pathname === '/pricing' || pathname === '/contact' || pathname === '/developers' || pathname === '/about' || pathname === '/ti'

    const frameSizing = isAppSurface
        ? 'mt-[7.5vh] h-[92.5vh]'
        : isMarketing
            ? 'mt-[4.5rem] h-[calc(100vh-4.5rem)]'
            : 'mt-[8.25vh] h-[91.75vh] md:mt-[9.5vh] md:h-[90.5vh]'

    return (
        <div className={`relative z-10 ${frameSizing} w-full overflow-auto`}>
            {isAppSurface || isMarketing ? null : <BackgroundSketches />}
            <main className={`w-full ${isAppSurface ? 'h-full' : isMarketing ? 'min-h-full' : 'min-h-[90.5vh] pt-3 md:pt-0'}`}>
                {children}
            </main>
            {isAppSurface || isMarketing ? null : <Footer />}
        </div>
    )
}
