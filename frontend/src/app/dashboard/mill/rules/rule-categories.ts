export const ruleCategories = {
    match: { label: 'Match filter', description: 'Match event fields, signatures, and vulnerability records.' },
    analysis: { label: 'Analyze filter', description: 'Control log retention and analyze activity.' },
    detection: { label: 'Detection filter', description: 'Detect attack patterns across related events.' },
} as const

export type RuleCategory = keyof typeof ruleCategories

const analysisRules = new Set(['mongodb.cashflow_connections.v1', 'http.routine_access.v1', 'auth.impossible_travel.v1', 'auth.new_country.v1', 'auth.new_device.v1'])
const matchRules = new Set(['network.signature_alert.v1', 'vulnerability.cve_asset_context.v1'])

export function getRuleCategory(rule: { id: string, source?: string }): RuleCategory {
    // Custom and imported rules are evaluated as normalized event-field conditions.
    if (rule.source === 'owned' || rule.source === 'open_source' || matchRules.has(`${rule.id.replace(/\.v\d+$/, '')}.v1`)) return 'match'
    if (analysisRules.has(`${rule.id.replace(/\.v\d+$/, '')}.v1`)) return 'analysis'
    return 'detection'
}
