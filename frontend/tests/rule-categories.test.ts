// @ts-expect-error Bun provides this module when running focused tests.
import { describe, expect, test } from 'bun:test'
import { getRuleCategory } from '../src/app/dashboard/mill/rules/rule-categories'

describe('rule categories', () => {
    test.each([
        ['auth.brute_force_success.v1', 'detection'],
        ['auth.password_spray.v1', 'detection'],
        ['auth.impossible_travel.v1', 'analysis'],
        ['auth.new_country.v1', 'analysis'],
        ['auth.new_device.v1', 'analysis'],
        ['network.signature_alert.v1', 'match'],
        ['vulnerability.cve_asset_context.v1', 'match'],
    ])('%s belongs to %s', (id: string, category: string) => {
        expect(getRuleCategory({ id, source: 'hanasand' })).toBe(category)
    })
    test.each(['owned', 'open_source'])('%s conditions use the match category', (source: string) => {
        expect(getRuleCategory({ id: 'custom.authentication', source })).toBe('match')
    })
})
