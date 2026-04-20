import type { SeverityLevel } from '@/utils/monitoring/types'

export const severityOrder: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'unknown']

export const severityLabel: Record<SeverityLevel, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    unknown: 'Unknown',
}

export const severityClasses: Record<SeverityLevel, string> = {
    critical: 'border-red-400/25 bg-red-500/10 text-red-200',
    high: 'border-orange-400/25 bg-orange-500/10 text-orange-200',
    medium: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
    low: 'border-sky-400/25 bg-sky-500/10 text-sky-200',
    unknown: 'border-login-100/10 bg-login-50/5 text-login-200',
}
