import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { passwordMeetsRequirements } from '../src/utils/auth/password'

test('signup and reset require sixteen characters and one of each character type', () => {
    for (const password of ['Abcdefghijklmn1!', 'A calm river flows1!', 'existing AA11!! password']) assert.equal(passwordMeetsRequirements(password), true)
    for (const password of ['', 'Shortpass1!', 'abcdefghijklmn1!', 'ABCDEFGHIJKLMN1!', 'Abcdefghijklmnop!', 'Abcdefghijklmnop1', 'Abcdefghijklmno1 ']) assert.equal(passwordMeetsRequirements(password), false)
})
