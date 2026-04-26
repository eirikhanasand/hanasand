import type { OrchestrationEvent } from './types.ts'

const EVENT_PREFIX = 'HANASAND_EVENT '

export function serializeWorkerEvent(event: OrchestrationEvent) {
    return `${EVENT_PREFIX}${JSON.stringify(event)}`
}

export function parseWorkerEventLine(line: string) {
    if (!line.startsWith(EVENT_PREFIX)) {
        return null
    }

    try {
        return JSON.parse(line.slice(EVENT_PREFIX.length)) as OrchestrationEvent
    } catch {
        return null
    }
}
