import { expect, test } from 'bun:test'
import { verifyWorkerToken } from '../src/utils/promptPortal/store'

test('prompt worker accepts the current token and the rotation overlap token only', () => {
    const env = { PROMPT_PORTAL_WORKER_TOKEN: 'current-token', PROMPT_PORTAL_WORKER_TOKEN_PREVIOUS: 'previous-token' }
    expect(verifyWorkerToken('current-token', env)).toBe(true)
    expect(verifyWorkerToken('previous-token', env)).toBe(true)
    expect(verifyWorkerToken('unknown-token', env)).toBe(false)
    expect(verifyWorkerToken(null, env)).toBe(false)
    expect(verifyWorkerToken('previous-token', { PROMPT_PORTAL_WORKER_TOKEN: 'current-token' })).toBe(false)
})
