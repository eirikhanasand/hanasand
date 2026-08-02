import type { Metadata } from 'next'
import MillWorkspace from './workspace'

export const metadata: Metadata = { title: 'Mill', description: 'Review tenant-scoped log-monitoring findings.' }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <MillWorkspace />
}
