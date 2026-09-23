import type { MillRule } from './detection-rules'

export type RuleSortColumn = 'Title' | 'Description' | 'Family' | 'Severity' | 'Status' | 'Source' | 'Hits' | 'Action' | 'Controls'
export type RuleSortDirection = 'ascending' | 'descending'
export const defaultRuleSortDirection = (column: RuleSortColumn): RuleSortDirection => column === 'Hits' ? 'descending' : 'ascending'
const compareText = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })
function textValue(rule: MillRule, column: RuleSortColumn) {
    switch (column) {
        case 'Title': return rule.name
        case 'Description': return rule.explanation
        case 'Family': return rule.family
        case 'Severity': return rule.severity
        case 'Status': return rule.enabled === false ? 'Disabled' : 'Enabled'
        case 'Source': return rule.source === 'open_source' ? 'Imported rule' : rule.source === 'owned' ? 'Custom rule' : 'Hanasand rule'
        case 'Action': return rule.definition?.action === 'drop' ? 'Drop' : 'Store'
        case 'Controls': return rule.enabled === false ? 'Enable' : 'Disable'
        default: return ''
    }
}
export function compareRules(a: MillRule, b: MillRule, column: RuleSortColumn, direction: RuleSortDirection) {
    let result: number
    if (column === 'Hits') {
        const aKnown = typeof a.hitCount === 'number' && Number.isFinite(a.hitCount)
        const bKnown = typeof b.hitCount === 'number' && Number.isFinite(b.hitCount)
        // An unavailable count is not zero and stays last in either direction.
        if (aKnown !== bKnown) return aKnown ? -1 : 1
        result = aKnown && bKnown ? a.hitCount! - b.hitCount! : 0
    } else result = compareText(textValue(a, column), textValue(b, column))
    return (direction === 'descending' ? -result : result) || compareText(a.name, b.name) || compareText(a.id, b.id)
}
