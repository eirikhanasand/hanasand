import { beforeEach, expect, mock, test } from 'bun:test'
let stored: Record<string, any> = {}, findings: any[] = [], fail = false, findingWrites = 0, eventUpdates = 0, pendingLookups = 0, completedLookups = 0
let authRechecks: Array<{ sql: string, params: any[] }> = []
const query = async (sql: string, p: any[] = []): Promise<any> => {
    if (sql.includes('WITH later_users AS')) { authRechecks.push({ sql, params: p }); return { rows: [] } }
    if (sql.includes('SELECT id, event_timestamp, outcome, source_country, normalized')) return { rows: [] }
    if (sql.includes('SELECT id, user_id, event_timestamp, normalized')) return { rows: [] }
    if (sql.includes('INSERT INTO events')) { for (const item of JSON.parse(p[0])) stored[item.id] = { id: item.id, processing_status: item.processing_status, normalized: item.normalized }; return { rows: JSON.parse(p[0]).map((item: any) => ({ id: item.id })) } }
    if (sql.includes('SELECT id FROM events') && sql.includes("processing_status = 'processed'")) { completedLookups++; return { rows: Object.values(stored).filter(row => p[0].includes(row.id) && row.processing_status === 'processed').map(row => ({ id: row.id })) } }
    if (sql.includes('SELECT id FROM events')) { pendingLookups++; return { rows: Object.values(stored).filter(row => row.processing_status !== 'processed').map(row => ({ id: row.id })) } }
    if (sql.includes('INSERT INTO findings')) {
        findingWrites++
        if (fail) throw new Error('Storage temporarily failed')
        for (const item of JSON.parse(p[0])) if (!findings.some(row => row.key === item.finding_key)) findings.push({ ...item, key: item.finding_key })
        return { rows: [] }
    }
    if (sql.includes('SELECT rule_id, severity')) return { rows: findings }
    if (sql.includes('UPDATE events')) { eventUpdates++; for (const item of JSON.parse(p[0])) { stored[item.id].normalized = {...stored[item.id].normalized,...item.result};stored[item.id].processing_status='processed' }return { rows: [] } }
    throw new Error('Unexpected SQL '+sql)
}
mock.module('#db',()=>({ default:query, withTransaction: async(work: any)=>{ const before=structuredClone({stored,findings});try{return await work(query)}catch(error){stored=before.stored;findings=before.findings;throw error} } }))
const { processLog, processLogBatch } = await import('../src/utils/events/processLogs.ts')
const { BUILTIN_RULES, defaultRuleDefinition } = await import('../src/handlers/events.ts')
const { securityRules } = await import('../src/utils/events/securityRules.ts')
const rules = () => BUILTIN_RULES.map(rule => ({...rule,enabled:true,source:'hanasand' as const,definition:defaultRuleDefinition(rule.id)}))
const log = (executable='/usr/bin/whoami',command='whoami') => ({id:'real-log',service:'audit',host:'inspur',level:'info',message:command,created_at:'2026-09-19T10:00:00Z',metadata:{process:{executable,command_line:command}}})
beforeEach(()=>{stored={};findings=[];fail=false;findingWrites=0;eventUpdates=0;pendingLookups=0;completedLookups=0;authRechecks=[]})
test('an info-level whoami executes Event and persists high severity plus evidence',async()=>{
    await processLog(log(),'org-a',rules())
    const row: any=Object.values(stored)[0]
    expect(row.processing_status).toBe('processed');expect(row.normalized.level).toBe('info');expect(row.normalized.severity).toBe('high')
    expect(row.normalized.detections[0].rule_id).toBe('process.recon.whoami.v1')
    expect(row.normalized.rules_checked).toBe(BUILTIN_RULES.length)
})
test('retry after a failed finding insert, then deduplicate repeated delivery',async()=>{
    fail=true;await expect(processLog(log(),'org-a',rules())).rejects.toThrow()
    expect(Object.values(stored)).toHaveLength(0);expect(findings).toHaveLength(0)
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
for(const rule of securityRules) test(`${rule.id} produces a persisted Event finding`,async()=>{
    await processLog(rule.field==='executable'?log(rule.positive,rule.positive):log('/bin/bash',rule.positive),'org-a',rules())
    expect(findings.some(finding=>finding.rule_id===rule.id)).toBe(true)
})

for (const [args, expectedRule, severity] of [
    [['env', 'python3', '/usr/local/sbin/hanasand-log-collector', '--recent', '300'], null, 'low'],
    [['env', 'bash', '/path/script'], null, 'low'], [['env', '-u', 'HOME'], 'process.recon.env.v1', 'high'],
    [['env', 'printenv'], 'process.recon.printenv.v1', 'high'], [['env', '-i', 'xmrig'], 'process.tool.xmrig.v1', 'critical'],
] as Array<[string[], string | null, string]>) test(`Event applies env invocation semantics: ${args.join(' ')}`, async () => {
    const input = log('/usr/bin/env', args.join(' '))
    await processLog({ ...input, metadata: { process: { ...input.metadata.process, arguments: args } } }, 'org-a', rules())
    const row = Object.values(stored)[0]
    expect(row.processing_status).toBe('processed')
    expect(row.normalized.rules_checked).toBe(BUILTIN_RULES.length)
    expect(row.normalized.severity).toBe(severity)
    if (expectedRule) expect(findings.map(finding => finding.rule_id)).toEqual([expectedRule])
    else expect(findings).toHaveLength(0)
})

test('id execution persists a low-severity finding', async () => {
    await processLog(log('/usr/bin/id', 'id'), 'org-a', rules())
    expect(findings.find(finding => finding.rule_id === 'process.recon.id.v1')?.severity).toBe('low')
    expect(Object.values(stored)[0].normalized.severity).toBe('low')
})

test('stateless detections use bounded bulk writes without dropping or duplicating findings', async () => {
    const logs = Array.from({ length: 1001 }, (_, i) => ({ ...log(), id: String(i) }))
    await processLogBatch(logs, 'org-a', rules())
    expect(findings).toHaveLength(1001)
    expect(findingWrites).toBe(2)
    expect(pendingLookups).toBe(0); expect(completedLookups).toBe(1)
    expect(Object.values(stored).every(row => row.processing_status === 'processed')).toBe(true)
    await processLogBatch(logs, 'org-a', rules())
    expect(findings).toHaveLength(1001)
    expect(findingWrites).toBe(2)
    expect(pendingLookups).toBe(0); expect(completedLookups).toBe(2)
})

test('login events keep their pending correlation lookup', async () => {
    const login = { id: 'login', service: 'sshd', host: 'inspur', level: 'info', message: 'Accepted password for alice from 192.0.2.1', created_at: '2026-09-19T10:00:00Z' }
    await processLogBatch([login], 'org-a', [])
    expect(pendingLookups).toBe(1); expect(completedLookups).toBe(1)
    expect(Object.values(stored)[0].processing_status).toBe('processed')
})

test('late authentication rechecks use bounded user and source-IP index lanes', async () => {
    const login = { id: 'late-login', service: 'sshd', host: 'inspur', level: 'info', message: 'Failed password for alice from 192.0.2.1', created_at: '2026-09-19T10:00:00Z' }
    await processLogBatch([login], 'org-a', rules())
    expect(authRechecks).toHaveLength(1)
    const { sql, params } = authRechecks[0]
    expect(params[1]).toBe('inspur:alice')
    expect(params[2]).toBe('192.0.2.1')
    expect(params[3]).toBe('failure')
    expect(params[6]).toBe(25)
    expect(sql).toContain('e.user_id = $2')
    expect(sql).toContain('md5(e.source_ip) = md5($3::text)')
    expect(sql).toContain('$4 = \'failure\'')
    expect(sql).toContain('e.outcome = \'success\'')
    expect(sql).toContain('LIMIT $7')
    expect(sql).not.toContain(' OR e.source_ip')
    expect(sql).not.toContain('OFFSET')
})

for (const [program, command] of [['uname', 'uname -o'], ['uname', 'uname -r'], ['ps', 'ps -eo pid,comm,args'], ['ps', 'ps aux']]) {
    test(`${command} persists a low-severity finding`, async () => {
        await processLog(log(`/usr/bin/${program}`, command), 'org-a', rules())
        expect(findings.find(finding => finding.rule_id === `process.recon.${program}.v1`)?.severity).toBe('low')
        expect(Object.values(stored)[0].normalized.severity).toBe('low')
    })
}


test('non-login authentication messages finish atomically with their configured findings', async () => {
    const configured = [...rules(), { id: 'owned.auth-health', name: 'Auth health', version: '1', severity: 'low', enabled: true, source: 'owned' as const,
        definition: { conditions: [{ path: 'service', operator: 'equals', value: 'hanasand-auth' }] } }] as any
    await processLogBatch(Array.from({ length: 50 }, (_, i) => ({ id: `auth-health-${i}`, service: 'hanasand-auth', host: 'inspur', level: 'info', message: 'Service ready', created_at: new Date().toISOString() })), 'org-a', configured)
    expect(Object.values(stored).every(row => row.processing_status === 'processed')).toBe(true)
    expect(findings).toHaveLength(50)
    expect(findingWrites).toBe(1)
    expect(eventUpdates).toBe(0)
})
