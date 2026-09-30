import { expect, test } from 'bun:test'
import { asksForHuman } from '../src/utils/support/assistant.ts'

test('support handoff matches direct requests without matching general mentions', () => {
    const cases: Array<[string, boolean]> = [
        ['support', true],
        ['Support!', true],
        ['customer support', true],
        ['support team', true],
        ['talk to support', true],
        ['Thanks for your support', false],
        ['Are you a human?', false],
        ['I do not want to speak with support', false],
    ]

    for (const [message, expected] of cases) expect(asksForHuman(message)).toBe(expected)
})
