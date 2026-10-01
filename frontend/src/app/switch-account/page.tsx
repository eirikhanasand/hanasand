import type { Metadata } from 'next'
import SwitchAccountPage from './pageClient'

export const metadata: Metadata = {
    title: 'Switch account',
    robots: { index: false, follow: false },
}

export default function Page() {
    return <SwitchAccountPage />
}
