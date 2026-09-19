import { expect, test } from 'bun:test'
import { compileLogQuery } from '../src/utils/logs/kql.ts'
import { normalizeLogEvent } from '../src/utils/mill/logEvent.ts'

test('KQL values are parameters, fields and operators are allowlisted', () => {
    const query = compileLogQuery('ProcessLogs | where (Severity == "critical" or CommandLine contains "whoami") and TimeGenerated > ago(1h) | order by TimeGenerated desc | take 50')
    expect(query.params).toEqual(['ProcessLogs', 'critical', 'whoami', 3600])
    expect(query.limit).toBe(50)
    expect(query.where.join(' ')).not.toContain('whoami')
    expect(() => compileLogQuery('Logs | where evil == "x"')).toThrow('Unknown field')
    expect(() => compileLogQuery('Logs | delete')).toThrow('Unsupported')
    expect(() => compileLogQuery('Logs | take 999999')).toThrow()
    expect(compileLogQuery('Logs | where Message contains "x\' OR 1=1 --"').params).toEqual(["x' OR 1=1 --"])
})
test('KQL projection, aggregation, quoted pipes and malformed syntax', () => {
    expect(compileLogQuery('Logs | project TimeGenerated, Host, CommandLine').projection).toHaveLength(3)
    expect(compileLogQuery('Logs | summarize count() by Severity').summarize).toBe('Severity')
    expect(compileLogQuery('Logs | where Message contains "curl | bash"').params).toEqual(['curl | bash'])
    expect(() => compileLogQuery('Logs | where (Severity == "high"')).toThrow()
    expect(() => compileLogQuery('Logs | where Severity ==')).toThrow()
})
test('original level is preserved independently of security severity', () => {
    for (const [level, severity] of [['info','low'], ['warn','medium'], ['error','high'], ['fatal','critical']]) {
        const event = normalizeLogEvent({ id: 1, service: 'api', level, message: 'message', created_at: '2026-09-19T00:00:00Z' })
        expect(event.level).toBe(level); expect(event.severity).toBe(severity)
    }
    expect(normalizeLogEvent({ id: 2, service: 'audit', level: 'info', message: 'whoami', created_at: new Date(), metadata: { process: { executable: '/usr/bin/whoami' } } }).log_type).toBe('ProcessLogs')
})

test('KQL rejects unsupported pipeline semantics instead of silently reordering operations', () => {
    for (const input of ['Logs | take 10 | where Severity == "critical"', 'Logs | take 5 | take 50', 'Logs | project Host | where Message contains "test"', 'Logs | order by Host asc | summarize count() by Severity']) {
        expect(() => compileLogQuery(input)).toThrow()
    }
    expect(() => compileLogQuery('Logs | where TimeGenerated > ago(99999d)')).toThrow()
    const rule = compileLogQuery('Logs | where RuleId contains "%"')
    expect(rule.where.join(' ')).toContain('strpos(')
    expect(rule.where.join(' ')).not.toContain('ILIKE')
    expect(compileLogQuery('Logs | where Message has "foo"').where.join(' ')).toContain('regexp_split_to_array')
})
test('normalizes HTTP aliases and SSH identity context without mixing level and severity', () => {
    const base = { id: '1', service: 'api', level: 'info', created_at: '2026-09-19T00:00:00Z' }
    expect(normalizeLogEvent({ ...base, message: 'request', metadata: { url: '/api/logs', statusCode: 500 } })).toMatchObject({ log_type: 'HttpLogs', http: { path: '/api/logs', status_code: 500 } })
    expect(normalizeLogEvent({ ...base, service: 'sshd', host: 'inspur', message: 'Failed password for alice from 192.0.2.1 port 22' })).toMatchObject({ log_type: 'SigninLogs', action: 'login', outcome: 'failure', source: { ip: '192.0.2.1' }, user: { id: 'inspur:alice' } })
})
