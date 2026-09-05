import type { Metadata } from 'next'
import MillWorkspace from '../workspace'

export const metadata: Metadata = { title: 'Detection rules', description: 'Create, import, and configure organization detection rules.' }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <MillWorkspace view='rules' />
}
