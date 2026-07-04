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
    critical: 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger',
    high: 'border-ui-danger/25 bg-ui-danger/10 text-ui-danger',
    medium: 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning',
    low: 'border-ui-primary/30 bg-ui-primary/10 text-ui-primary',
    unknown: 'border-ui-border bg-ui-raised text-ui-muted',
}
