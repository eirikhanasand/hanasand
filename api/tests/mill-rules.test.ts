import { describe, expect, test } from 'bun:test'
import { MILL_RULES, validateMillEventFields } from '../src/handlers/mill.ts'

describe('Mill detection catalog', () => {
    test('keeps rule identifiers unique and explanations evidence-backed', () => {
        expect(new Set(MILL_RULES.map(rule => rule.id)).size).toBe(MILL_RULES.length)
        expect(MILL_RULES.every(rule => rule.id.endsWith(`.v${rule.version}`) && rule.explanation && rule.evidence.length > 0)).toBe(true)
    })

    test('reports invalid timestamps by event field', () => {
        expect(validateMillEventFields([{ timestamp: 'not-a-date' }, {}, { timestamp: '2026-08-03T08:15:00Z' }])).toEqual([
            { field: 'events[0].timestamp', message: 'timestamp must be a valid ISO-8601 date string.' },
        ])
    })
})
