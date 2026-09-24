import { matchesMillRule, type MillCondition } from './conditions.ts'

export const applicationErrorRuleId = 'application.headers_already_sent.v1'
export const applicationErrorDefinition = { match: 'all' as const, stage: 'analyze' as const, action: 'keep' as const,
    conditions: [
        { path: 'service', operator: 'equals' as const, value: 'hanasand-api', caseSensitive: true },
        { path: 'message', operator: 'equals' as const, value: 'Cannot writeHead headers after they are sent to the client', caseSensitive: true },
    ], parameters: {} }
export const applicationErrorRule = { id: applicationErrorRuleId, version: '1', name: 'Response headers already sent',
    family: 'Application', severity: 'medium', enabled: true,
    explanation: 'Store duplicate-response failures from hanasand-api as application errors at the configured severity.',
    evidence: ['service', 'message'], definition: applicationErrorDefinition }
type Rule = { id?: string, enabled?: boolean, severity?: string, version?: string, definition?: { conditions?: MillCondition[] } }

export function classifyApplicationError<T extends { service: string, message: string, level: string, metadata?: Record<string, unknown> }>(log: T, rules: Rule[] = []) {
    const rule = rules.find(rule => rule.id === applicationErrorRuleId) || applicationErrorRule
    if (rule.enabled === false || !rule.definition?.conditions?.length || !matchesMillRule(log, rule.definition.conditions)) return null
    return { level: 'error' as const, severity: rule.severity || 'medium', metadata: { ...log.metadata,
        category: 'application_error', action: 'error', surface: 'application', error_code: 'ERR_HTTP_HEADERS_SENT', error_message: log.message,
        classification: { rule_id: applicationErrorRuleId, rule_version: rule.version || '1', original_level: log.metadata?.classification && typeof log.metadata.classification === 'object'
            ? (log.metadata.classification as Record<string, unknown>).original_level || log.level : log.level },
    } }
}
