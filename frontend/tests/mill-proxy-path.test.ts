import { readFile } from 'node:fs/promises'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
// @ts-expect-error Bun provides this module when running focused tests.
import { expect } from 'bun:test'

test('Mill workspace uses the authenticated backend proxy for every API call', async () => {
    const source = await readFile(new URL('../src/app/dashboard/mill/workspace.tsx', import.meta.url), 'utf8')
    expect(source).toContain('/api/backend/mill/findings')
    expect(source).toContain('/api/backend/mill/events')
    expect(source).toContain('/api/backend/mill/rules')
    expect(source).toContain('/api/backend/mill/usage')
    expect(source).not.toContain('/api/mill/')
})
