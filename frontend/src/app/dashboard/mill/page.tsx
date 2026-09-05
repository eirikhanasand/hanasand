import type { Metadata } from 'next'
import MillWorkspace from './workspace'

export const metadata: Metadata = { title: 'Security overview', description: 'Review organization-specific security monitoring findings.' }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <MillWorkspace />
}
