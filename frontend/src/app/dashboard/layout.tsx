import { ReactNode } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { dashboardPageTitle } from '@/utils/layout/dashboardPageTitle'

export async function generateMetadata(): Promise<Metadata> {
    const path = (await headers()).get('x-current-path') || '/dashboard'
    return {
        title: dashboardPageTitle(path),
        description: 'Customer dashboard for company exposure monitoring, threat search, webhook alerts, and API access.',
    }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return children
}
