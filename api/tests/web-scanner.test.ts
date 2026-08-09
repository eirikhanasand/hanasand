import { describe, expect, test } from 'bun:test'
import { headerChecks } from '../src/utils/vulnerabilities/webScanner.ts'

describe('Hanasand safe web scanner', () => {
    test('reports missing security controls without sending a request', () => {
        const checks = headerChecks({ server: 'example' }, true)
        expect(checks.find(check => check.id === 'header.hsts')?.status).toBe('fail')
        expect(checks.find(check => check.id === 'header.csp')?.status).toBe('warn')
        expect(checks.find(check => check.id === 'header.server')?.status).toBe('warn')
    })
})
