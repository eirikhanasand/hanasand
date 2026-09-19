import { describe, expect, test } from 'bun:test'
import { securityRules, matchSecurityRules } from '../src/utils/mill/securityRules.ts'

describe('process security rule catalog', () => {
    test('has approximately 100 distinct rules with stable IDs', () => {
        expect(securityRules.length + 7).toBeGreaterThanOrEqual(95)
        expect(securityRules.length + 7).toBeLessThanOrEqual(110)
        expect(new Set(securityRules.map(rule => rule.id)).size).toBe(securityRules.length)
    })
    for (const rule of securityRules) {
        test(`${rule.id}: detects execution and rejects benign input and mentions`, () => {
            const event = (value: string) => ({ event_type: 'process', action: 'exec', process: { [rule.field === 'command' ? 'command_line' : 'executable']: value } })
            expect(matchSecurityRules(event(rule.positive)).map(item => item.id)).toContain(rule.id)
            expect(matchSecurityRules(event(rule.negative)).map(item => item.id)).not.toContain(rule.id)
            expect(matchSecurityRules({ event_type: 'application', message: rule.positive, process: event(rule.positive).process })).toEqual([])
        })
    }
    test('curl fetching BloodHound is critical, ordinary curl is not', () => {
        const event = (command: string) => ({ event_type: 'process', action: 'exec', process: { executable: '/usr/bin/curl', command_line: command } })
        expect(matchSecurityRules(event('curl -LO https://example.test/BloodHound.zip'))).toContainEqual(expect.objectContaining({ severity: 'critical' }))
        expect(matchSecurityRules(event('curl -I https://hanasand.com'))).toEqual([])
    })
})

test('interpreted scripts and quoted audit arguments are checked without flagging quoted mentions', () => {
    const event = (executable: string, args: string[]) => ({ event_type: 'process', action: 'exec', process: { executable, arguments: args, command_line: args.map(arg => /\s/.test(arg) ? `'${arg}'` : arg).join(' ') } })
    for (const args of [['python3', '/opt/BloodHound.py'], ['bash', '/tmp/linpeas.sh']]) {
        expect(matchSecurityRules(event(`/usr/bin/${args[0]}`, args)).some(rule => rule.id.includes(args[1].includes('Blood') ? 'bloodhound' : 'linpeas'))).toBe(true)
    }
    expect(matchSecurityRules(event('/bin/bash', ['bash', '-c', 'curl -LO https://example.test/BloodHound.zip']))).toContainEqual(expect.objectContaining({ id: 'process.behavior.tool_download.v1', severity: 'critical' }))
    expect(matchSecurityRules(event('/bin/bash', ['bash', '-c', 'whoami']))).toContainEqual(expect.objectContaining({ id: 'process.recon.whoami.v1' }))
    for (const args of [['echo', 'curl -LO https://example.test/BloodHound.zip'], ['echo', '/usr/bin/xmrig'], ['bash', '-c', 'echo "curl -LO https://example.test/BloodHound.zip"'], ['bash', '-c', 'echo "cat /etc/shadow"']]) {
        expect(matchSecurityRules(event(`/usr/bin/${args[0]}`, args))).toEqual([])
    }
})

const envEvent = (args: string[], structured = true) => ({ event_type: 'process', action: 'exec', process: {
    executable: '/usr/bin/env', ...(structured ? { arguments: ['env', ...args] } : {}),
    command_line: ['env', ...args].map(arg => /\s/.test(arg) ? `'${arg}'` : arg).join(' '),
} })
for (const args of [[], ['-0'], ['-u', 'HOME'], ['--unset=HOME'], ['-i', 'FIXTURE=1'], ['-vuHOME', 'FIXTURE=1'], ['--']]) {
    test(`env enumeration remains high: ${args.join(' ') || '(no arguments)'}`, () => {
        for (const structured of [true, false]) expect(matchSecurityRules(envEvent(args, structured))).toContainEqual(expect.objectContaining({ id: 'process.recon.env.v1', severity: 'high' }))
    })
}
for (const args of [
    ['python3', '/usr/local/sbin/hanasand-log-collector', '--recent', '300'], ['bash', '/path/script'],
    ['-i', 'FIXTURE=1', 'python3', '/path/script'], ['-C', '/tmp', 'bash', '/path/script'],
    ['--unset', 'HOME', 'python3', '/path/script'], ['-S', 'bash /path/script'],
    ['-vS', 'python3 /usr/local/sbin/hanasand-log-collector --recent 300'], ['--help'], ['--version'],
    ['-S', 'echo "whoami; xmrig"'],
]) {
    test(`env launching a benign command is not enumeration: ${args.join(' ')}`, () => {
        for (const structured of [true, false]) expect(matchSecurityRules(envEvent(args, structured))).toEqual([])
    })
}
for (const [args, rule] of [
    [['whoami'], 'process.recon.whoami.v1'], [['printenv'], 'process.recon.printenv.v1'],
    [['xmrig'], 'process.tool.xmrig.v1'], [['--unset', 'HOME', 'xmrig'], 'process.tool.xmrig.v1'],
    [['--chdir=/tmp', 'xmrig'], 'process.tool.xmrig.v1'], [['-a', 'worker', 'xmrig'], 'process.tool.xmrig.v1'],
    [['-S', 'python3 /opt/BloodHound.py'], 'process.tool.bloodhound.v1'],
    [['--split-string=curl -LO https://example.test/BloodHound.zip'], 'process.behavior.tool_download.v1'],
    [['-i', 'FIXTURE=1', 'bash', '-c', 'whoami'], 'process.recon.whoami.v1'],
] as Array<[string[], string]>) {
    test(`env preserves the child detection: ${args.join(' ')}`, () => {
        for (const structured of [true, false]) {
            const matches = matchSecurityRules(envEvent(args, structured))
            expect(matches).toContainEqual(expect.objectContaining({ id: rule }))
            expect(matches).not.toContainEqual(expect.objectContaining({ id: 'process.recon.env.v1' }))
        }
    })
}

test('unsupported env options do not invent child execution, and executable-only telemetry stays conservative', () => {
    expect(matchSecurityRules(envEvent(['--unsupported-option', 'xmrig']))).toEqual([])
    expect(matchSecurityRules({ event_type: 'process', action: 'exec', process: { executable: '/usr/bin/env' } }))
        .toContainEqual(expect.objectContaining({ id: 'process.recon.env.v1' }))
    expect(matchSecurityRules({ event_type: 'process', action: 'exec', process: { executable: '/opt/xmrig', arguments: ['worker'] } }))
        .toContainEqual(expect.objectContaining({ id: 'process.tool.xmrig.v1', severity: 'critical' }))
    expect(matchSecurityRules({ event_type: 'process', action: 'exec', process: { executable: '/bin/bash', arguments: ['bash', '-c', 'env'] } }))
        .toContainEqual(expect.objectContaining({ id: 'process.recon.env.v1' }))
})
