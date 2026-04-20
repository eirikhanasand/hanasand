import type { SeverityLevel } from '@/utils/monitoring/types'
import { severityClasses, severityLabel } from './constants'

export default function InlineSeverityBadge({ severity, count }: { severity: SeverityLevel, count: number }) {
    if (count === 0) return null

    return (
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${severityClasses[severity]}`}>
            {severityLabel[severity]} {count}
        </span>
    )
}
