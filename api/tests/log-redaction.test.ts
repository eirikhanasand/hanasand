import { expect, test } from 'bun:test'
import { redactLogText, redactLogValue } from '../src/utils/logs/redact.ts'
test('redacts common credential forms and argument pairs without deleting execution evidence', () => {
    const text = redactLogText('curl --password "private value" https://user:pass@example.test/BloodHound.zip?token=abc&x=1 -H "Authorization: Bearer xyz" API_KEY=hidden')
    for (const secret of ['private value', 'user:pass', 'token=abc', 'Bearer xyz', 'API_KEY=hidden']) expect(text).not.toContain(secret)
    expect(text).toContain('BloodHound.zip')
    expect(redactLogValue({ password: 'hidden', nested: { token: 'hidden' }, arguments: ['curl', '--password', 'secret-value', '--url', 'https://example.test'] })).toEqual({ password: '[REDACTED]', nested: { token: '[REDACTED]' }, arguments: ['curl', '--password', '[REDACTED]', '--url', 'https://example.test'] })
    expect(redactLogText('Failed password for alice from 192.0.2.1 port 22 ssh2')).toBe('Failed password for alice from 192.0.2.1 port 22 ssh2')
    expect(redactLogText('Accepted publickey for alice from 192.0.2.1 port 22')).toContain('for alice from')
})
