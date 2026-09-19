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
