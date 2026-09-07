import { test, expect, mock } from 'bun:test'
let checks = 0
mock.module('../src/utils/pwned/checkPwned.ts', () => ({ default: async(password: string) => {
    checks++
    return { ok: password !== 'Knownbreachedpass1!', count: password === 'Knownbreachedpass1!' ? 10 : 0 }
} }))
const { validatePassword } = await import('../src/utils/auth/password.ts')

test('requires sixteen characters and one of each character type, and rejects breached passwords', async() => {
    for (const password of ['Shortpass1!', 'abcdefghijklmn1!', 'ABCDEFGHIJKLMN1!', 'Abcdefghijklmnop!', 'Abcdefghijklmnop1', 'Abcdefghijklmno1 ', '', null, 123]) {
        expect((await validatePassword(password as string)).valid).toBe(false)
    }
    expect(checks).toBe(0)
    for (const password of ['Abcdefghijklmn1!', 'A calm river flows1!', 'existing AA11!! password']) {
        expect((await validatePassword(password)).valid).toBe(true)
    }
    expect(checks).toBe(3)
    expect((await validatePassword('Knownbreachedpass1!')).valid).toBe(false)
    expect(checks).toBe(4)
})
