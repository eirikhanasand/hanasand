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

    return (
        <div className={`relative z-10 ${isAppSurface ? 'mt-[7.5vh] h-[92.5vh]' : 'mt-[8.25vh] h-[91.75vh] md:mt-[9.5vh] md:h-[90.5vh]'} w-full overflow-auto`}>
            {isAppSurface ? null : <BackgroundSketches />}
            <main className={`w-full ${isAppSurface ? 'h-full' : 'min-h-[90.5vh] pt-3 md:pt-0'}`}>
                {children}
            </main>
            {isAppSurface ? null : <Footer />}
        </div>
    )
}
