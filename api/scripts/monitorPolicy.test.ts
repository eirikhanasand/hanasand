import { describe, expect, test } from 'bun:test'
import { activityFreshnessMinutes } from '../src/utils/status/monitorPolicy.ts'

describe('activity freshness', () => {
    test('uses content age before the age of the last check', () => {
        expect(activityFreshnessMinutes({ collectionAgeMinutes: 80, collectionCheckAgeMinutes: 4 })).toBe(80)
    })

    test('falls back to a recent check only when content ages are unavailable', () => {
        expect(activityFreshnessMinutes({ collectionAgeMinutes: null, claimAgeMinutes: null, collectionCheckAgeMinutes: 4 })).toBe(4)
    })
})
