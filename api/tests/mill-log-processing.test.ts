import { beforeEach, expect, mock, test } from 'bun:test'
let stored: Record<string, any> = {}, findings: any[] = [], fail = false
const query = async (sql: string, p: any[] = []): Promise<any> => {
    if (sql.includes('SELECT log_key FROM mill_events')) return { rows: Object.values(stored)
        .filter(row => p[0].includes(row.log_key) && row.processing_status === 'processed').map(row => ({ log_key: row.log_key })) }
    if (sql.includes('INSERT INTO mill_events')) { for (const item of JSON.parse(p[0])) stored[item.id] ||= { id: item.id, log_key: item.key, processing_status: item.processing_status, normalized: item.normalized }; return { rows: [] } }
    if (sql.includes('SELECT id FROM mill_events')) return { rows: Object.values(stored).filter(row => row.processing_status !== 'processed') }
    if (sql.includes('INSERT INTO mill_findings')) {
        if (fail) throw new Error('Storage temporarily failed')
        if (!findings.some(row => row.key === p[2])) findings.push({ key:p[2], rule_id:p[3], severity:p[4], summary:p[5], evidence:JSON.parse(p[6]),event_ids:p[7] })
        return { rows: [] }
    }
    if (sql.includes('SELECT rule_id, severity')) return { rows: findings }
    if (sql.includes('UPDATE mill_events')) { for (const item of JSON.parse(p[0])) { stored[item.id].normalized = {...stored[item.id].normalized,...item.result};stored[item.id].processing_status='processed' }return { rows: [] } }
    throw new Error('Unexpected SQL '+sql)
}
mock.module('#db',()=>({ default:query, withTransaction: async(work:any)=>work(query) }))
const { processLog } = await import('../src/utils/mill/processLogs.ts')
const { MILL_RULES, millDefaultDefinition } = await import('../src/handlers/mill.ts')
const { securityRules } = await import('../src/utils/mill/securityRules.ts')
const rules = () => MILL_RULES.map(rule => ({...rule,enabled:true,source:'hanasand' as const,definition:millDefaultDefinition(rule.id)}))
const log = (executable='/usr/bin/whoami',command='whoami') => ({id:'real-log',service:'audit',host:'inspur',level:'info',message:command,created_at:'2026-09-19T10:00:00Z',metadata:{process:{executable,command_line:command}}})
beforeEach(()=>{stored={};findings=[];fail=false})
test('an info-level whoami executes Mill and persists high severity plus evidence',async()=>{
    await processLog(log(),'org-a',rules())
    const row:any=Object.values(stored)[0]
    expect(row.processing_status).toBe('processed');expect(row.normalized.level).toBe('info');expect(row.normalized.severity).toBe('high')
    expect(row.normalized.detections[0].rule_id).toBe('process.recon.whoami.v1')
    expect(row.normalized.rules_checked).toBe(MILL_RULES.length)
})
test('retry after a failed finding insert, then deduplicate repeated delivery',async()=>{
    fail=true;await expect(processLog(log(),'org-a',rules())).rejects.toThrow()
    expect(Object.values(stored)[0].processing_status).toBe('pending')
    fail=false;await processLog(log(),'org-a',rules());await processLog(log(),'org-a',rules())
    expect(findings).toHaveLength(1)
})
test('organization enabled state, severity and conditions affect actual detections',async()=>{
    const configured=rules();const rule=configured.find(rule=>rule.id==='process.recon.whoami.v1')!
    rule.enabled=false;await processLog(log(),'org-a',configured);expect(findings).toHaveLength(0)
    stored={};rule.enabled=true;rule.severity='critical';await processLog(log(),'org-a',configured);expect(findings[0].severity).toBe('critical')
    stored={};findings=[];rule.definition.conditions=[{path:'host',operator:'equals',value:'different-host'}]
    await processLog(log(),'org-a',configured);expect(findings).toHaveLength(0)
})
for(const rule of securityRules) test(`${rule.id} produces a persisted Mill finding`,async()=>{
    await processLog(rule.field==='executable'?log(rule.positive,rule.positive):log('/bin/bash',rule.positive),'org-a',rules())
    expect(findings.some(finding=>finding.rule_id===rule.id)).toBe(true)
})

for (const [args, expectedRule, severity] of [
    [['env', 'python3', '/usr/local/sbin/hanasand-log-collector', '--recent', '300'], null, 'low'],
    [['env', 'bash', '/path/script'], null, 'low'], [['env', '-u', 'HOME'], 'process.recon.env.v1', 'high'],
    [['env', 'printenv'], 'process.recon.printenv.v1', 'high'], [['env', '-i', 'xmrig'], 'process.tool.xmrig.v1', 'critical'],
] as Array<[string[], string | null, string]>) test(`Mill applies env invocation semantics: ${args.join(' ')}`, async () => {
    const input = log('/usr/bin/env', args.join(' '))
    await processLog({ ...input, metadata: { process: { ...input.metadata.process, arguments: args } } }, 'org-a', rules())
    const row = Object.values(stored)[0]
    expect(row.processing_status).toBe('processed')
    expect(row.normalized.rules_checked).toBe(MILL_RULES.length)
    expect(row.normalized.severity).toBe(severity)
    if (expectedRule) expect(findings.map(finding => finding.rule_id)).toEqual([expectedRule])
    else expect(findings).toHaveLength(0)
})

test('id execution persists a low-severity finding', async () => {
    await processLog(log('/usr/bin/id', 'id'), 'org-a', rules())
    expect(findings.find(finding => finding.rule_id === 'process.recon.id.v1')?.severity).toBe('low')
    expect(Object.values(stored)[0].normalized.severity).toBe('low')
})
