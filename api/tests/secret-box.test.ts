import { describe, expect, test } from 'bun:test'
import { decryptSecret, deriveSecretKey, encryptSecret } from '../src/utils/crypto/secretBox.ts'

describe('secret box key rotation', () => {
    const previousKey = deriveSecretKey('fixture-previous-key')
    const currentKey = deriveSecretKey('fixture-current-key')

    test('reads existing ciphertext with the previous key and writes with the current key', () => {
        const existing = encryptSecret('stored credential', previousKey)
        expect(decryptSecret(existing, [currentKey, previousKey])).toBe('stored credential')

        const rotated = encryptSecret(decryptSecret(existing, [currentKey, previousKey]), currentKey)
        expect(decryptSecret(rotated, [currentKey, previousKey])).toBe('stored credential')
        expect(() => decryptSecret(rotated, [previousKey])).toThrow('configured keys')
    })

    test('retains support for legacy plaintext values', () => {
        expect(decryptSecret('legacy-value', [currentKey, previousKey])).toBe('legacy-value')
    })
})
