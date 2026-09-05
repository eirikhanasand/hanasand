import { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: {
        default: 'Dashboard | Hanasand',
        template: '%s | Hanasand',
    },
    description: 'Customer dashboard for company exposure monitoring, threat search, webhook alerts, and API access.',
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return children
}
