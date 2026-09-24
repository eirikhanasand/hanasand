import { expect, test } from 'bun:test'
import { fixture, configure, keys } from '../../../api/tests/analyze-readiness-audit.test'
import { markReadinessContext, signReadinessChain, attestReadinessAudit } from '../readinessAttestation'
import { eligibleReadinessChain, readinessWrapperScript } from '../../../api/src/utils/mill/analyzeReadinessAudit'
import { readinessWrapperScript as observedScript } from '../readinessObserver'
import { parseAudit } from '../sources'
import type { LogEvent } from '../core'
const attrs = {success:'yes',exit:'0',auid:'4294967295',ses:'4294967295',tty:'(none)',uid:'0',euid:'0',suid:'0',fsuid:'0',gid:'0',egid:'0',sgid:'0',fsgid:'0'}
function raw(event: LogEvent, context=attrs) {
 const process=event.metadata.process as any,args=process.arguments as string[],identity=`msg=audit(${(Date.parse(event.timestamp)/1000).toFixed(3)}:${event.metadata.audit_id})`
 return [`type=SYSCALL ${identity} ${Object.entries(context).map(([key,value])=>`${key}=${value}`).join(' ')} pid=${process.pid} ppid=${process.parent_pid} exe="${process.executable}"`,
 `type=EXECVE ${identity} argc=${args.length} ${args.map((arg,index)=>`a${index}=${Buffer.from(arg).toString('hex')}`).join(' ')}`]
}
function parsed(context=attrs, badIndex=-1){const {logs,fact}=fixture();return {fact,events:logs.map((log,index)=>parseAudit(raw(log as LogEvent,index===badIndex?context:attrs).join('\n'),{host:'inspur'})[0]!)} }
test('raw complete native chain signs once and verifies every member',()=>{
 configure();const {events,fact}=parsed()
 expect(readinessWrapperScript).toBe(observedScript)
 const signed=signReadinessChain(events,fact,keys.privateKey)!
 expect(signed.atomic).toBe(true)
 expect(signed.events).toHaveLength(4);expect(eligibleReadinessChain(signed.events)).toBe(true)
 expect(signed.events.filter(event=>event.metadata.readiness_execution)).toHaveLength(1)
 expect(signed.events.map(event=>event.sourceEventId)).toEqual(events.map(event=>event.sourceEventId))
 expect(signReadinessChain(structuredClone(events),fact,keys.privateKey)).toBeUndefined()
 for(let index=0;index<4;index++)expect(signReadinessChain(events.filter((_,i)=>i!==index),fact,keys.privateKey)).toBeUndefined()
})
test('every role requires exact raw service context and unambiguous argument records',()=>{
 for(let index=0;index<4;index++){
  for(const field of Object.keys(attrs)) {const {events,fact}=parsed({...attrs,[field]:'suspicious'},index);expect(signReadinessChain(events,fact,keys.privateKey)).toBeUndefined()}
  for(const duplicate of ['SYSCALL','EXECVE']){
   const {logs,fact}=fixture(),events=logs.map((log,i)=>{const rows=raw(log as LogEvent);if(i===index)rows.push(rows[duplicate==='SYSCALL'?0:1]!);return parseAudit(rows.join('\n'),{host:'inspur'})[0]!})
   expect(signReadinessChain(events,fact,keys.privateKey)).toBeUndefined()
  }
 }
})
test('missing key and source failure preserve all originals',async()=>{
 const {events}=parsed()
 async function* input(){yield* events}
 const output=[];for await(const event of attestReadinessAudit(input(),'/nonexistent-readiness-test','inspur'))output.push(event)
 expect(output).toEqual(events)
 async function* failed(){yield* events;throw Error('audit read failed')}
 const partial=[];try{for await(const event of attestReadinessAudit(failed(),'/nonexistent-readiness-test','inspur'))partial.push(event);throw Error('Expected failure')}
 catch(error){expect((error as Error).message).toBe('audit read failed')}
 expect(partial).toEqual(events)
})
