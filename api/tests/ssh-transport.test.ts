import { expect, test } from 'bun:test'
import { sshTransportDefinition, sshTransportGroups, sshTransportRuleId } from '../src/utils/mill/analyzeSshTransport.ts'
import { routineEvidence, type RoutineLog } from '../src/utils/mill/analyzeRoutineGroups.ts'
import { retainedOriginals } from '../src/utils/mill/retainedOriginals.ts'

export function transportFixture(): RoutineLog[] {
    return ['debug2: channel 0: window 1966080 sent adjust 131072', 'debug3: send packet: type 93', 'debug2: channel 0: rcvd adjust 32768', 'debug3: receive packet: type 93'].map((message, i) => ({
        service: 'sshd', host: 'inspur', level: 'debug', message, timestamp: new Date(Date.now() - 2000 + i * 20).toISOString(), sourceEventId: String(i + 1).repeat(64),
        metadata: { collector: 'journal', unit: 'ssh.service', pid: '3532511', user: { id: '1000' } },
    }))
}
const groups = (logs: RoutineLog[]) => sshTransportGroups(logs, sshTransportDefinition.conditions)
test('exact transport summary preserves all originals and detector input, independent of batch order', async () => {
    const logs = transportFixture(), result = await groups(logs)
    expect(result).toHaveLength(1)
    expect(result[0].ruleId).toBe(sshTransportRuleId)
    expect(routineEvidence(result[0]).original_records).toEqual(logs)
    const originals = retainedOriginals({ id: '1', service: 'routine-group-analyzer', host: 'inspur', level: 'info', message: 'SSH transport debug summary', created_at: logs[0].timestamp!, source_event_id: `routine-group:${result[0].key}`, metadata: routineEvidence(result[0]) })
    expect(originals.map(row => row.message)).toEqual(logs.map(row => row.message))
    expect(originals.map(row => row.metadata)).toEqual(logs.map(row => row.metadata))
    expect((await groups([...logs].reverse()))[0].key).toBe(result[0].key)
})
test('authentication, brute force, BloodHound commands, connections, forwarding and all other packet types stay raw', async () => {
    const messages = [
        'Failed password for root from 203.0.113.9 port 4444 ssh2',
        'Accepted publickey for root from 203.0.113.9 port 4444 ssh2: ED25519 SHA256:abc',
        'Invalid user admin from 203.0.113.9 port 4444',
        'Connection from 203.0.113.9 port 4444 on 10.0.0.1 port 22',
        'Starting session: command for hanasand from 203.0.113.9 port 4444 id 0',
        'debug1: command: bloodhound-python -c All', 'debug1: command: SharpHound.exe -c All',
        'debug1: server_request_direct_tcpip: originator 127.0.0.1 port 4444, target 10.0.0.1 port 389',
        'refused local port forward: originator 127.0.0.1 port 4444', 'error: channel open failed',
        'debug3: send packet: type 93 [preauth]', 'debug2: channel 0: rcvd adjust 32768 [preauth]',
        'debug2: channel 0: rcvd adjust 32768\n', 'debug3: send packet: type 93\nFailed password',
        'debug3: send packet: type 93 bloodhound', 'DEBUG3: send packet: type 93',
        'debug2: channel 0: rcvd adjust 9999999999',
        ...Array.from({ length: 256 }, (_, type) => type).filter(type => type !== 93).flatMap(type => [`debug3: send packet: type ${type}`, `debug3: receive packet: type ${type}`]),
    ]
    for (const message of messages) {
        const logs = transportFixture(); logs[1].message = message
        expect(await groups(logs)).toEqual([])
    }
})
test('unknown evidence, flagged activity, partial groups and edited saved policy fail closed', async () => {
    for (const mutate of [
        (logs: RoutineLog[]) => { logs[0].metadata!.detections = [{ name: 'BloodHound' }] },
        (logs: RoutineLog[]) => { logs[0].metadata!.source = { ip: '203.0.113.9' } },
        (logs: RoutineLog[]) => { logs[0].metadata!.suspicious = true },
        (logs: RoutineLog[]) => { logs[0].metadata!.user = { id: '1000', command: 'SharpHound.exe' } },
        (logs: RoutineLog[]) => { logs[0].level = 'error' },
        (logs: RoutineLog[]) => { logs[0].metadata!.unit = 'unfamiliar.service' },
        (logs: RoutineLog[]) => { for (const log of logs) log.host = 'unfamiliar' },
        (logs: RoutineLog[]) => { logs[0].sourceEventId = logs[1].sourceEventId },
    ]) { const logs = transportFixture(); mutate(logs); expect(await groups(logs)).toEqual([]) }
    expect(await groups(transportFixture().slice(0, 1))).toEqual([])
    expect(await sshTransportGroups(transportFixture(), [])).toEqual([])
    expect(await sshTransportGroups(transportFixture(), [{ path: 'host', operator: 'equals', value: 'other' }])).toEqual([])
})
