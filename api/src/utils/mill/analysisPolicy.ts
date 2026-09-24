import type { MillCondition } from './conditions.ts'
import { matchAnalysisEvents } from './analysisMatcher.ts'

type AnalysisDefinition = { stage?: string, action?: string, conditions?: MillCondition[] }

// Match the complete context before creating receipts, including on replay.
// A partial matching group cannot establish that the whole group is redundant.
export async function matchesAnalysisPolicy(events: Record<string, unknown>[], definition: AnalysisDefinition | undefined): Promise<boolean> {
    if (!events.length || definition?.stage !== 'analyze' || definition.action !== 'drop'
        || !Array.isArray(definition.conditions)) return false
    if (!definition.conditions.length) return true
    return (await matchAnalysisEvents(events, definition.conditions)).length === events.length
}
