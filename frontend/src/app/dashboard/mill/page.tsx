import type { Metadata } from 'next'
import MillWorkspace from './workspace'

export const metadata: Metadata = { title: 'Security Monitoring', description: 'Review tenant-scoped security monitoring findings.' }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <MillWorkspace />
}
