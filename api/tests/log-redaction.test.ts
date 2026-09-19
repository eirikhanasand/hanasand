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

test('quoted headers and program-specific credential flags cannot leak trailing secrets', () => {
    const commands = [
        'curl -H "Cookie: first=synthetic-private; second=synthetic-private" https://example.test/BloodHound.zip',
        'curl -H "Authorization: Bearer synthetic-private" https://example.test',
        'curl -u "user:synthetic-private" https://example.test',
        'curl -Usynthetic-private --oauth2-bearer synthetic-private https://example.test',
        'curl --proxy-user=user:synthetic-private https://example.test',
        'sshpass -p synthetic-private ssh example.test',
        'mysql -psynthetic-private -e "SELECT 1"',
        'mariadb -p synthetic-private', 'redis-cli -a synthetic-private',
        'tool --client-secret-key synthetic-private',
    ]
    for (const command of commands) expect(redactLogText(command)).not.toContain('synthetic-private')
    expect(redactLogText(commands[0])).toBe('curl -H "Cookie: [REDACTED]" https://example.test/BloodHound.zip')
    for (const args of [['/usr/bin/curl', '-u', 'user:synthetic-private'], ['curl', '--proxy-user=user:synthetic-private'], ['sshpass', '-p', 'synthetic-private'], ['mysql', '-psynthetic-private'], ['redis-cli', '-a', 'synthetic-private'], ['tool', '--client-secret-key', 'synthetic-private']]) {
        expect(JSON.stringify(redactLogValue(args))).not.toContain('synthetic-private')
    }
    expect(redactLogText('mkdir -p /etc/cron.d')).toBe('mkdir -p /etc/cron.d')
    expect(redactLogValue(['mkdir', '-p', '/etc/cron.d'])).toEqual(['mkdir', '-p', '/etc/cron.d'])
    expect(redactLogValue(['ps', '-p', '123'])).toEqual(['ps', '-p', '123'])
})
