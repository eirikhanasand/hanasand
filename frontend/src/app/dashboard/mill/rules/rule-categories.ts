export const ruleCategories = {
    match: { label: 'Match filter', description: 'Match event fields, signatures, and vulnerability records.' },
    analysis: { label: 'Analysis filter', description: 'Compare activity with previous logins and known behavior.' },
    detection: { label: 'Detection filter', description: 'Detect attack patterns across related events.' },
} as const

export type RuleCategory = keyof typeof ruleCategories

const analysisRules = new Set(['auth.impossible_travel.v1', 'auth.new_country.v1', 'auth.new_device.v1'])
const matchRules = new Set(['network.signature_alert.v1', 'vulnerability.cve_asset_context.v1'])

export function getRuleCategory(rule: { id: string, source?: string }): RuleCategory {
    // Custom and imported rules are evaluated as normalized event-field conditions.
    if (rule.source === 'owned' || rule.source === 'open_source' || matchRules.has(rule.id)) return 'match'
    if (analysisRules.has(rule.id)) return 'analysis'
    return 'detection'
}
