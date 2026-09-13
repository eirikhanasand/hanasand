// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { isReservedPlaceholder } from '../src/utils/users/isReservedPlaceholder'

test('active accounts remain regular users even with reserved names', () => {
    expect(isReservedPlaceholder({ id: 'eirikhanasand', active: true })).toBe(false)
    expect(isReservedPlaceholder({ id: 'stable-id', username: 'admin', active: true })).toBe(false)
})

test('only explicitly inactive reserved accounts are placeholders', () => {
    expect(isReservedPlaceholder({ id: 'root', active: false })).toBe(true)
    expect(isReservedPlaceholder({ id: 'stable-id', username: 'admin', active: false })).toBe(true)
    expect(isReservedPlaceholder({ id: 'ole', active: false })).toBe(false)
    expect(isReservedPlaceholder({ id: 'admin' })).toBe(false)
})
