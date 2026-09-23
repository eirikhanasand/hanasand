import { expect, test } from 'bun:test'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { markReadinessContext, signReadinessEvent, attestReadinessAudit } from '../readinessAttestation'
import { eligibleReadinessAudit, readinessArguments } from '../../../api/src/utils/mill/analyzeReadinessAudit'
import type { LogEvent } from '../core'

const keys = generateKeyPairSync('ed25519')
const attrs = {success:'yes',exit:'0',auid:'4294967295',ses:'4294967295',tty:'(none)',uid:'0',euid:'0',suid:'0',fsuid:'0',gid:'0',egid:'0',sgid:'0',fsgid:'0'}
const rows = ['type=SYSCALL msg=audit(1790208000.100:42) success=yes', 'type=EXECVE msg=audit(1790208000.100:42) argc=5 a0="pg" a1="-U" a2="hanasand" a3="-d" a4="db"']
function fixture() {
    const time = 1790208000100, nonce='3e735e7b-4d7f-444d-9806-231fa26cfcec', args=readinessArguments(nonce)
    const command=args.slice(0,4).join(' ')+" '"+args[4]+"'"
    const event: LogEvent={host:'inspur',service:'audit',level:'info',message:command,timestamp:new Date(time).toISOString(),
        sourceEventId:createHash('sha256').update('inspur:audit:msg=audit(1790208000.100:42)').digest('hex'),
        metadata:{collector:'auditd',event_type:'process',action:'exec',outcome:'success',audit_id:'42',
            user:{id:'0',login_id:'4294967295'},process:{executable:args[0]!,command_line:command,arguments:args,pid:'12345',parent_pid:'12000'}}}
    const fact={version:1,host:'inspur',nonce,bootId:nonce,containerId:'a'.repeat(64),execId:'b'.repeat(64),parentPid:12000,parentStartTicks:'123456',namespacePid:12,startedAt:time-10,finishedAt:time+100,previousStartedAt:time-5010}
    return {event,fact}
}
test('only authenticated raw service context can produce API-verifiable signatures',()=>{
    const old=process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY
    try {
        process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY=keys.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex')
        const {event,fact}=fixture()
        expect(signReadinessEvent(event,fact,keys.privateKey)).toBeUndefined()
        markReadinessContext(event,attrs,rows)
        const signed=signReadinessEvent(event,fact,keys.privateKey)!
        expect(signed).toBeDefined();expect(eligibleReadinessAudit(signed)).toBe(true)
        expect(signReadinessEvent(structuredClone(event),fact,keys.privateKey)).toBeUndefined()
        for (const field of ['success','exit','auid','ses','tty','uid','euid','suid','fsuid','gid','egid','sgid','fsgid']) {
            const {event,fact}=fixture();markReadinessContext(event,{...attrs,[field]:'suspicious'},rows)
            expect(signReadinessEvent(event,fact,keys.privateKey)).toBeUndefined()
        }
        for (const malformed of [[...rows,rows[0]!],[...rows,rows[1]!],[rows[0]!,rows[1]!.replace('argc=5','argc=6')],[rows[0]!+' uid=0 uid=0',rows[1]!]]) {
            const {event,fact}=fixture();markReadinessContext(event,attrs,malformed)
            expect(signReadinessEvent(event,fact,keys.privateKey)).toBeUndefined()
        }
    } finally { if(old===undefined)delete process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY;else process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY=old }
})
test('missing native fact/key preserves candidate original unchanged',async()=>{
    const {event}=fixture();markReadinessContext(event,attrs,rows)
    async function* events(){yield event}
    const output=[];for await(const row of attestReadinessAudit(events(),'/nonexistent-readiness-test','inspur'))output.push(row)
    expect(output).toEqual([event])
})
test('real audit parser preserves provenance only for unambiguous service execution',async()=>{
    const {parseAudit}=await import('../sources')
    const {fact}=fixture(), args=readinessArguments(fact.nonce)
    const identity='msg=audit(1790208000.100:42)'
    const syscall=`type=SYSCALL ${identity} ${Object.entries(attrs).map(([k,v])=>`${k}=${v}`).join(' ')} pid=12345 ppid=12000 exe="${args[0]}"`
    const exec=`type=EXECVE ${identity} argc=5 ${args.map((arg,i)=>`a${i}=${Buffer.from(arg).toString('hex')}`).join(' ')}`
    const good=parseAudit(syscall+'\n'+exec,{host:'inspur'})[0]!
    expect(signReadinessEvent(good,fact,keys.privateKey)).toBeDefined()
    for(const text of [syscall.replace('euid=0','euid=1000')+'\n'+exec,syscall+'\n'+exec+'\n'+exec,
        syscall+'\n'+exec.replace('argc=5','argc=6'),syscall.replace('tty=(none)','tty=pts1')+'\n'+exec]) {
        const log=parseAudit(text,{host:'inspur'})[0]!
        expect(signReadinessEvent(log,fact,keys.privateKey)).toBeUndefined()
    }
})
test('source failure flushes buffered originals then propagates error',async()=>{
    const {event}=fixture()
    async function* events(){yield event;throw new Error('audit read failed')}
    const output=[]
    try { for await(const row of attestReadinessAudit(events(),'/nonexistent-readiness-test','inspur'))output.push(row);throw new Error('Expected source failure') }
    catch(error){expect((error as Error).message).toBe('audit read failed')}
    expect(output).toEqual([event])
})
