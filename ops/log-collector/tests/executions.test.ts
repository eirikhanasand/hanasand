import { expect, test } from 'bun:test'
import { parseAudit } from '../sources'
import { type Execution } from '../executions'
import { eligibleCollectorExecution, routineCollectorArguments } from '../../../api/src/utils/mill/analyzeCollector.ts'
const args = ['ausearch', '--input-logs', '--checkpoint', '/var/lib/hanasand-log-collector/audit-live.pending', '-k', 'hanasand_exec', '--raw']
const proof: Execution = { unit: 'hanasand-log-collector.service', boot_id: '3e735e7b-4d7f-444d-9806-231fa26cfcec', pid: '12345', parent_pid: '12000', started_at: 1790193600000, finished_at: 1790193600100, executable: '/usr/sbin/ausearch', arguments: args, exit_code: 0, stderr_empty: true }
const raw = `type=SYSCALL msg=audit(1790193600.010:42): arch=c000003e syscall=59 success=yes exit=0 ppid=12000 pid=12345 auid=4294967295 uid=0 gid=0 euid=0 suid=0 fsuid=0 egid=0 sgid=0 fsgid=0 tty=(none) ses=4294967295 exe="/usr/sbin/ausearch"\ntype=EXECVE msg=audit(1790193600.010:42): argc=7 ${args.map((arg, i) => `a${i}="${arg}"`).join(' ')}`
const sample = () => parseAudit(raw, { host: 'inspur' }, [structuredClone(proof)])[0]
test('parser output requires a completed command and keeps unverified records unchanged', () => {
    expect(eligibleCollectorExecution(sample())).toBe(true)
    const unknown = parseAudit(raw, { host: 'inspur' })[0]
    expect(eligibleCollectorExecution(unknown)).toBe(false)
    const verified = sample(); delete verified.metadata.collector_execution
    expect(verified).toEqual(unknown)
})
test('manual, failed, wrong executable and PID-reused executions have no proof', () => {
    for (const changed of [raw.replace('ppid=12000', 'ppid=12001'), raw.replace('auid=4294967295', 'auid=1000'), raw.replace('euid=0', 'euid=1000'), raw.replace('tty=(none)', 'tty=pts0'), raw.replace('success=yes', 'success=no'), raw.replace('exe="/usr/sbin/ausearch"', 'exe="/tmp/ausearch"'), raw.replaceAll('1790193600.010', '1790193601.010')]) {
        const event = parseAudit(changed, { host: 'inspur' }, [proof])[0]
        expect(event.metadata.collector_execution).toBeUndefined()
        expect(eligibleCollectorExecution(event)).toBe(false)
    }
    for (const change of [{ exit_code: 1 }, { stderr_empty: false }]) expect(parseAudit(raw, { host: 'inspur' }, [{ ...proof, ...change }])[0].metadata.collector_execution).toBeUndefined()
})
test('requires exact envelope, host, command and completion context', () => {
    for (const change of [{ host: 'customer' }, { service: 'other' }, { level: 'error' }, { message: 'unexpected' }, { sourceEventId: 'b'.repeat(64) }, { timestamp: 'bad' }]) expect(eligibleCollectorExecution({ ...sample(), ...change })).toBe(false)
    for (const field of ['metadata', 'process', 'user', 'collector_execution']) {
        const event = sample(), target = field === 'metadata' ? event.metadata : event.metadata[field] as Record<string, unknown>
        target.unexpected = 'suspicious content'
        expect(eligibleCollectorExecution(event)).toBe(false)
    }
    for (const change of [{ unit: 'manual.service' }, { boot_id: 'bad' }, { exit_code: 1 }, { stderr_empty: false }, { pid: '12346' }, { parent_pid: '12001' }, { started_at: proof.started_at + 50 }, { finished_at: proof.started_at + 61000 }, { arguments: ['bash'] }]) {
        const event = sample(); Object.assign(event.metadata.collector_execution as object, change)
        expect(eligibleCollectorExecution(event)).toBe(false)
    }
})
test('only checkpointed live audit and cursor-based journal commands qualify', () => {
    const journal = ['journalctl', '--no-pager', '-o', 'json', '--show-cursor', '--lines=+1000', '--after-cursor', `s=${'a'.repeat(32)};i=12;b=${'b'.repeat(32)};m=123;t=abc;x=123`]
    expect(routineCollectorArguments(args)).toBe(true); expect(routineCollectorArguments(journal)).toBe(true)
    for (const command of [[...args, '--start', 'checkpoint'], args.map(v => v.replace('audit-live.pending', 'audit.pending')), [...args, '--format', 'text'], journal.map(v => v === '--after-cursor' ? '--since' : v), [...journal, '--file', '/tmp/other'], journal.map(v => v.startsWith('s=') ? 's=unexpected' : v)]) expect(routineCollectorArguments(command)).toBe(false)
})
