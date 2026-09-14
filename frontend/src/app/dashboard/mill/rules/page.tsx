import type { Metadata } from 'next'
import DetectionRules from './detection-rules'

export const metadata: Metadata = { title: 'Rules', description: 'Create, import, and configure organization detection rules.' }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <DetectionRules />
}
