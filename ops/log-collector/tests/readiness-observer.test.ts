import { expect, test } from 'bun:test'
import { matchReadinessHealth, readNativeObservation, readinessWrapperScript, type ObservedReadinessExec, type NativeHealth } from '../readinessObserver.ts'

const start = Date.parse('2026-09-24T12:00:00.000Z'), container = 'a'.repeat(64)
const observation: ObservedReadinessExec = { containerId: container, execId: 'b'.repeat(64), bootId: '12345678-1234-4234-8234-123456789abc',
    execPid: 39999, execParentPid: 39998, execStartTicks: '987650',
    parentPid: 40000, parentStartTicks: '987654', namespacePid: 321, nonce: '12345678-1234-4234-8234-123456789abc', startedAt: start + 10, observedAt: start + 40, stableIdentity: true }
const health: NativeHealth = { Start: new Date(start).toISOString(), End: new Date(start + 150).toISOString(), ExitCode: 0,
    Output: 'hanasand-pg-ready-v1 nonce=12345678-1234-4234-8234-123456789abc pid=321\n/var/run/postgresql:5432 - accepting connections\n' }
test('native scheduled successful healthcheck joins exactly one observed process', () => {
    expect(matchReadinessHealth([observation], health, container, start - 5000)).toEqual({ version: 2, host: 'inspur', containerId: container,
        execPid: 39999, execParentPid: 39998, execStartTicks: '987650',
        execId: observation.execId, bootId: observation.bootId, parentPid: 40000, parentStartTicks: '987654', namespacePid: 321,
        nonce: '12345678-1234-4234-8234-123456789abc', startedAt: start, finishedAt: start + 150, previousStartedAt: start - 5000 })
})
test('manual execution without corresponding native health record does not qualify', () => {
    expect(matchReadinessHealth([], health, container, start - 5000)).toBeUndefined()
    expect(matchReadinessHealth([{ ...observation, startedAt: start - 5000, observedAt: start - 4950 }], health, container, start - 5000)).toBeUndefined()
    expect(matchReadinessHealth([observation], { ...health, Output: '' }, container, start - 5000)).toBeUndefined()
})
test('wrong or reused process identity, wrong container and ambiguous observations retain', () => {
    for (const change of [{ namespacePid: 322 }, { nonce: '12345678-1234-4234-8234-123456789abd' }, { containerId: 'c'.repeat(64) }, { stableIdentity: false }, { parentStartTicks: '0' },
        { startedAt: start - 30 }, { observedAt: start + 151 }, { bootId: 'bad' }, { execId: 'bad' },
        { execPid: 40000 }, { execPid: 0 }, { execParentPid: 0 }, { execStartTicks: '0' }]) {
        expect(matchReadinessHealth([{ ...observation, ...change }], health, container, start - 5000)).toBeUndefined()
    }
    expect(matchReadinessHealth([observation, { ...observation, execId: 'c'.repeat(64) }], health, container, start - 5000)).toBeUndefined()
})
test('errors, extra output and missing or invalid prior success cannot be attested', () => {
    for (const change of [{ ExitCode: 1 }, { Output: health.Output + 'warning\n' }, { Output: health.Output + '\n' }, { Output: health.Output.replace('accepting', 'rejecting') },
        { Start: 'bad' }, { End: new Date(start - 1).toISOString() }]) {
        expect(matchReadinessHealth([observation], { ...health, ...change }, container, start - 5000)).toBeUndefined()
    }
    for (const previous of [0, -1, NaN, Infinity, start, start + 1]) expect(matchReadinessHealth([observation], health, container, previous)).toBeUndefined()
})
test('native evidence leaves duration and cadence retention policy to Mill rules', () => {
    expect(matchReadinessHealth([observation], { ...health, End: new Date(start + 1001).toISOString() }, container, start - 5000)).toBeDefined()
    for (const previous of [start - 1, start - 3999, start - 15001, start - 3600000]) {
        expect(matchReadinessHealth([observation], health, container, previous)).toBeDefined()
    }
})

test('native snapshot binds a direct wrapper child and rejects PID reuse during capture', async () => {
    const context = { containerId: container, execId: 'b'.repeat(64), bootId: observation.bootId, startedAt: start }
    const execution = { ContainerID: container, Running: true, Pid: 100, ProcessConfig: { entrypoint: '/bin/sh', arguments: ['-c', 'pg_isready -U hanasand -d hanasand'] } }
    const shell = { pid: 100, parentPid: 90, namespacePid: 50, startTicks: '1000', command: ['/bin/sh', '-c', 'pg_isready -U hanasand -d hanasand'] }
    const wrapper = { pid: 101, parentPid: 100, namespacePid: 51, startTicks: '1001', command: ['/bin/sh', '-c', readinessWrapperScript, 'hanasand-readiness-v1', observation.nonce] }
    const read = async (pid: number) => pid === 100 ? shell : wrapper
    const good = await readNativeObservation(execution, context, read, async () => [101])
    expect(good?.parentPid).toBe(101)
    expect(good?.namespacePid).toBe(51)
    expect(good?.execPid).toBe(100)
    expect(good?.execParentPid).toBe(90)
    expect(good?.execStartTicks).toBe('1000')
    let reads = 0
    expect(await readNativeObservation(execution, context, async pid => {
        if (pid === 100) return shell
        return ++reads > 1 ? { ...wrapper, startTicks: '9999' } : wrapper
    }, async () => [101])).toBeUndefined()
    expect(await readNativeObservation(execution, context, async pid => pid === 100 ? shell : { ...wrapper, parentPid: 999 }, async () => [101])).toBeUndefined()
    expect(await readNativeObservation({ ...execution, ContainerID: 'c'.repeat(64) }, context, read, async () => [101])).toBeUndefined()
    expect(await readNativeObservation({ ...execution, ProcessConfig: { entrypoint: '/bin/sh', arguments: ['-c', 'pg_isready -U hanasand -d hanasand; id'] } }, context, read, async () => [101])).toBeUndefined()
    expect(await readNativeObservation(execution, context, async pid => pid === 100 ? { ...shell, command: ['/bin/sh', '-c', 'id'] } : wrapper, async () => [101])).toBeUndefined()
    expect(await readNativeObservation(execution, context, async () => ({ ...wrapper, pid: 100 }), async () => [])).toBeUndefined()
    let rootReads = 0
    expect(await readNativeObservation(execution, context, async pid => pid === 100 ? { ...shell, startTicks: ++rootReads > 1 ? '9999' : shell.startTicks } : wrapper, async () => [101])).toBeUndefined()
})
