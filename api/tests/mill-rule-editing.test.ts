import { beforeEach, expect, mock, test } from 'bun:test'

let role = 'owner', valid = true, auditFailure = false
let systemAdmin = false
let rows: any[] = [], audits: any[] = [], findings: any[] = [], events: any[] = []
const query = async (sql: string, p: any[] = []): Promise<any> => {
    if (sql.includes('FROM organizations')) return { rows: p[0] === 'org-a' ? [{ role }] : [] }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('FROM mill_rules')) return { rows: rows.filter(row => row.organization_id === p[0] && (!sql.includes('rule_id = $2') || row.rule_id === p[1])) }
    if (sql.includes('INSERT INTO mill_rules')) {
        const row = { id: p[0], organization_id: p[1], rule_id: p[2], version: p[3], name: p[4], family: p[5], severity: p[6], explanation: p[7], definition: JSON.parse(p[8]), source: p[9], source_reference: p[10], enabled: p[11] }
        rows = [...rows.filter(old => old.id !== row.id), row]
        return { rows: [row] }
    }
    if (sql.includes('INSERT INTO system_events')) {
        if (auditFailure) throw new Error('Audit unavailable')
        audits.push({ id: String(audits.length), event_type: p[0], actor_id: p[4], object_type: p[5], object_id: p[6], organization_id: p[7], context: JSON.parse(p[12]), created_at: '2026-09-14T12:00:00Z' })
        return { rows: [] }
    }
    if (sql.includes('SELECT count(*)::text AS count FROM mill_findings')) return { rows: [{ count: String(findings.filter(row => row.organizationId === p[0] && row.ruleId === p[1]).length) }] }
    if (sql.includes("context->'after'->>'version'")) return { rows: audits.filter(row => row.organization_id === p[0] && row.object_id === p[1] && (row.context.after?.version === p[3] || row.context.before?.version === p[3])).slice(-1) }
    if (sql.includes('FROM system_events')) return { rows: audits.filter(row => row.organization_id === p[0] && (row.object_id === p[1] || row.object_id === p[2])).slice(p[3], p[3] + 51) }
    if (sql.includes('INSERT INTO mill_events')) {
        events.push({ id: p[0], organization_id: p[2], event_timestamp: p[5], event_type: p[6], action: p[7], outcome: p[8], user_id: p[9], source_ip: p[11], normalized: JSON.parse(p[15]) })
        return { rows: [] }
    }
    if (sql.includes('UPDATE mill_events')) return { rows: [] }
    if (sql.trimStart().startsWith('SELECT') && sql.includes('FROM mill_events')) {
        const result = events.filter(row => row.organization_id === p[0] && (sql.includes('source_ip = $2') ? row.source_ip === p[1] : row.user_id === p[1]) && row.id !== p[2] && row.event_type === 'authentication' && row.action === 'login' && Date.parse(row.event_timestamp) <= Date.parse(p[3]))
            .sort((a, b) => Date.parse(b.event_timestamp) - Date.parse(a.event_timestamp))
        return { rows: sql.includes("INTERVAL '1 minute'") ? result.filter(row => row.outcome === 'failure' && Date.parse(row.event_timestamp) >= Date.parse(p[3]) - p[4] * 60000) : result.slice(0, p[4]) }
    }
    if (sql.includes('INSERT INTO mill_findings')) { findings.push(...JSON.parse(p[0]).map((item: any) => ({ organizationId: item.organization_id, ruleId: item.rule_id, severity: item.severity, evidence: item.evidence }))); return { rows: [] } }
    throw new Error(`Unexpected query: ${sql}`)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => {
    const beforeRows = structuredClone(rows), beforeAudit = structuredClone(audits)
    try { return await work(query) } catch (error) { rows = beforeRows; audits = beforeAudit; throw error }
} }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid, id: 'editor' }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: systemAdmin }) }))
mock.module('#utils/auth/apiKeys.ts', () => ({ validateApiKey: async () => ({ organizationId: 'org-a', apiKey: { scopes: [] } }), matchApiKeyScope: () => true }))
const { getMillRule, putMillRule, postMillRuleAction, postMillRule, postMillRulePack, ingestMill } = await import('../src/handlers/mill.ts')
const builtin = 'network.signature_alert.v1'
const reply = () => ({ statusCode: 200, status(code: number) { this.statusCode = code; return this }, send(body: any) { return body } })
const request = (id = builtin.replace(/\.v\d+$/, ''), body: any = {}, organizationId = 'org-a') => ({ params: { id }, query: { organizationId }, body, ip: '127.0.0.1', headers: { authorization: 'Bearer test-key' }, id: 'request-test' }) as any
const edit = { version: '1', name: 'Custom network alert', explanation: 'An important signature matched a network event.', severity: 'critical', enabled: true }
const network = { source: {}, events: [{ timestamp: '2026-09-14T12:00:00Z', event_type: 'network', action: 'alert', signature: 'Test signature' }] }
beforeEach(() => { rows = []; audits = []; findings = []; role = 'owner'; valid = true; auditFailure = false; events = []; systemAdmin = false })

test.each(['http.routine_access.v1', 'mongodb.cashflow_connections.v1'])('only system administrators can change %s retention; changes are versioned and audited', async (id) => {
    const definition = { match: 'all', stage: 'analyze', action: 'drop', conditions: [], parameters: id.startsWith('http.') ? { windowMinutes: 1, requestThreshold: 50 } : {} }
    rows = [{ id: 'platform-rule', organization_id: 'org-a', rule_id: id, version: '1', name: 'Routine successful requests', family: 'HTTP', severity: 'high', explanation: 'Count and drop routine successful HTTP requests.', source: 'hanasand', enabled: true, definition }]
    expect((await getMillRule(request(id), reply() as any)).canEdit).toBe(false)
    const denied = reply()
    await postMillRuleAction(request(id, { action: 'disable' }), denied as any)
    expect(denied.statusCode).toBe(403)
    systemAdmin = true
    const body = { ...edit, severity: 'high', definition: { ...definition, action: 'keep' } }
    const saved = await putMillRule(request(id, body), reply() as any)
    expect(saved.rule.definition.action).toBe('keep')
    expect(saved.rule.version).toBe('2')
    expect(audits[0].context.before.definition.action).toBe('drop')
    expect(audits[0].context.after.definition.action).toBe('keep')
    const invalid = reply()
    await putMillRule(request(id, { ...body, version: '2', definition: { ...definition, stage: 'detection' } }), invalid as any)
    expect(invalid.statusCode).toBe(400)
})

test('built-in detail ID survives editing, and new detections use saved severity and revision', async () => {
    const initial = await getMillRule(request(), reply() as any)
    expect(initial.rule.id).toBe(builtin)
    expect(initial.rule.version).toBe('1')
    await putMillRule(request(builtin, edit), reply() as any)
    const saved = await getMillRule(request(), reply() as any)
    expect(saved.rule).toMatchObject({ id: builtin, name: edit.name, severity: 'critical', version: '2' })
    expect(saved.audit[0].context.before.severity).toBe('high')
    expect(saved.audit[0].context.after.severity).toBe('critical')
    expect(saved.audit[0].actor_id).toBe('editor')
    await ingestMill(request(builtin, network), reply() as any)
    expect(findings[0]).toMatchObject({ ruleId: builtin, severity: 'critical', evidence: { ruleVersion: '2', ruleName: edit.name } })
    await postMillRuleAction(request(builtin, { action: 'disable' }), reply() as any)
    findings = []
    await ingestMill(request(builtin, network), reply() as any)
    expect(findings).toHaveLength(0)
    expect((await getMillRule(request(), reply() as any)).rule.name).toBe(edit.name)
})

test('rejects stale edits and never commits a rule without its audit event', async () => {
    await putMillRule(request(builtin, edit), reply() as any)
    const stale = reply()
    await putMillRule(request(builtin, { ...edit, name: 'Lost update' }), stale as any)
    expect(stale.statusCode).toBe(409)
    expect(rows[0].name).toBe(edit.name)
    auditFailure = true
    await expect(putMillRule(request(builtin, { ...edit, version: '2', name: 'Must roll back' }), reply() as any)).rejects.toThrow('Audit unavailable')
    expect(rows[0].name).toBe(edit.name)
    expect(audits).toHaveLength(1)
})

test('membership is required for detail/history, and only owner/admin may edit', async () => {
    for (const handler of [getMillRule, putMillRule]) {
        const forbidden = reply()
        await handler(request(builtin, edit, 'other-org'), forbidden as any)
        expect(forbidden.statusCode).toBe(403)
    }
    role = 'member'
    expect((await getMillRule(request(), reply() as any)).canEdit).toBe(false)
    const forbidden = reply()
    await putMillRule(request(builtin, edit), forbidden as any)
    expect(forbidden.statusCode).toBe(403)
    valid = false
    const anonymous = reply()
    await getMillRule(request(), anonymous as any)
    expect(anonymous.statusCode).toBe(401)
    expect(audits).toHaveLength(0)
})

test('custom condition edits affect matching; invalid definitions are rejected', async () => {
    const created = await postMillRule(request('', { ...edit, conditions: [{ path: 'signature', operator: 'equals', value: 'Other' }] }), reply() as any)
    const id = created.rule.id
    await ingestMill(request('', network), reply() as any)
    expect(findings.some(row => row.ruleId === id)).toBe(false)
    await putMillRule(request(id, { ...edit, conditions: [{ path: 'signature', operator: 'equals', value: 'Test signature' }] }), reply() as any)
    await ingestMill(request('', network), reply() as any)
    expect(findings.some(row => row.ruleId === id && row.evidence.ruleVersion === '2')).toBe(true)
    const invalid = reply()
    await putMillRule(request(id, { ...edit, version: '2', conditions: [{ path: 'signature', operator: 'regex', value: '[' }] }), invalid as any)
    expect(invalid.statusCode).toBe(400)
    const replacement = reply()
    await putMillRule(request(builtin, { ...edit, conditions: [] }), replacement as any)
    expect(replacement.statusCode).toBe(400)
})

test('reimport retains ID and disabled state and adds a per-rule audit revision', async () => {
    const pack = { packName: 'Test pack', packVersion: '1', sourceReference: 'https://example.com/rules', rules: [{ id: 'network', ...edit, conditions: [{ path: 'signature', operator: 'equals', value: 'Test' }] }] }
    await postMillRulePack(request('', pack), reply() as any)
    const id = rows[0].rule_id, recordId = rows[0].id
    await postMillRuleAction(request(recordId, { action: 'disable' }), reply() as any)
    await postMillRulePack(request('', pack), reply() as any)
    expect(rows[0]).toMatchObject({ id: recordId, rule_id: id, enabled: false, version: '3' })
    const detail = await getMillRule(request(id.replace(/\.v\d+$/, '')), reply() as any)
    expect(detail.audit).toHaveLength(3)
    expect(detail.audit.every((entry: any) => entry.context.ruleId === id)).toBe(true)
})

test('unchanged saves do not clutter history, and older audit pages remain accessible', async () => {
    await putMillRule(request(builtin, edit), reply() as any)
    await putMillRule(request(builtin, { ...edit, version: '2' }), reply() as any)
    expect(audits).toHaveLength(1)
    expect(rows[0].version).toBe('2')
    for (let index = 1; index < 52; index++) audits.push({ ...audits[0], id: String(index) })
    const first = await getMillRule(request(), reply() as any)
    expect(first.audit).toHaveLength(50)
    expect(first.nextOffset).toBe(50)
    const secondRequest = request()
    secondRequest.query.offset = '50'
    const second = await getMillRule(secondRequest, reply() as any)
    expect(second.audit).toHaveLength(2)
    expect(second.nextOffset).toBeNull()
})


test('trigger count includes all saved detections only for this organization and stable rule ID', async () => {
    expect((await getMillRule(request(), reply() as any)).triggerCount).toBe(0)
    findings.push(
        { organizationId: 'org-a', ruleId: builtin, status: 'new', version: '1' },
        { organizationId: 'org-a', ruleId: builtin, status: 'resolved', version: '2' },
        { organizationId: 'other-org', ruleId: builtin },
        { organizationId: 'org-a', ruleId: 'auth.impossible_travel.v1' },
    )
    expect((await getMillRule(request(), reply() as any)).triggerCount).toBe(2)
    expect((await getMillRule(request('auth.impossible_travel.v1'), reply() as any)).triggerCount).toBe(1)
})

const bruteId = 'auth.brute_force_success'
const bruteDefinition = (windowMinutes = 15, minimumCount = 3) => ({ match: 'all', parameters: { windowMinutes, minimumCount }, conditions: [{ path: 'EventID', operator: 'equals', value: '4624' }], failureConditions: [{ path: 'EventID', operator: 'regex', value: '^(4625|4771)$' }] })
const login = (minutes: number, outcome: string, EventID: number, extra = {}) => ({ timestamp: new Date(Date.UTC(2026, 8, 14, 12, minutes)).toISOString(), event_type: 'authentication', action: 'login', outcome, EventID, user: { id: 'alice' }, ...extra })
const ingest = (items: any[]) => ingestMill(request('', { events: items }), reply() as any)
const bruteFindings = () => findings.filter(item => item.ruleId === `${bruteId}.v1`)

test('stable links return latest; historical links return immutable, read-only signatures', async () => {
    await putMillRule(request(bruteId, { ...edit, definition: bruteDefinition(20, 4) }), reply() as any)
    expect((await getMillRule(request(bruteId), reply() as any)).rule.definition.parameters).toEqual({ windowMinutes: 20, minimumCount: 4 })
    const old = await getMillRule(request(`${bruteId}.v1`), reply() as any)
    expect(old).toMatchObject({ canEdit: false, isHistorical: true, currentVersion: '2', rule: { version: '1', definition: { parameters: { windowMinutes: 15, minimumCount: 3 } } } })
    const latest = await getMillRule(request(`${bruteId}.v2`), reply() as any)
    expect(latest).toMatchObject({ canEdit: true, isHistorical: false })
    const missing = reply()
    await getMillRule(request(`${bruteId}.v99`), missing as any)
    expect(missing.statusCode).toBe(404)
})

test('saved window, threshold and both event-ID selectors control actual ingestion, including out-of-order batches', async () => {
    await putMillRule(request(bruteId, { ...edit, definition: bruteDefinition(5, 2) }), reply() as any)
    await ingest([login(10, 'success', 4624), login(5, 'failure', 4625), login(6, 'failure', 4771)])
    expect(bruteFindings()).toHaveLength(1)
    expect(bruteFindings()[0].evidence).toMatchObject({ windowMinutes: 5, minimumCount: 2, ruleVersion: '2' })
    findings = []
    await ingest([login(10, 'success', 9999), login(12, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(0)
    await putMillRule(request(bruteId, { ...edit, version: '2', definition: bruteDefinition(10, 2) }), reply() as any)
    await ingest([login(12, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(1)
    await putMillRule(request(bruteId, { ...edit, version: '3', definition: bruteDefinition(10, 3) }), reply() as any)
    findings = []
    await ingest([login(12, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(0)
})

test('correlation excludes other users, tenants, future events, wrong actions and wrong event IDs', async () => {
    await putMillRule(request(bruteId, { ...edit, definition: bruteDefinition(5, 2) }), reply() as any)
    await ingest([login(6, 'failure', 4625), login(7, 'failure', 1), login(8, 'failure', 4625, { user: { id: 'bob' } }), login(8, 'failure', 4625, { action: 'logout' }), login(11, 'failure', 4625)])
    events.push({ ...events[0], id: 'other-org', organization_id: 'org-b' })
    await ingest([login(10, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(0)
})

test('more than 30 intervening events cannot hide in-window failures', async () => {
    await putMillRule(request(bruteId, { ...edit, definition: bruteDefinition(15, 3) }), reply() as any)
    await ingest([login(1, 'failure', 4625), login(2, 'failure', 4625), login(3, 'failure', 4771), ...Array.from({ length: 35 }, () => login(4, 'unknown', 0)), login(10, 'success', 4624)])
    expect(bruteFindings()).toHaveLength(1)
})

test('invalid parameters and expressions never overwrite a saved detection', async () => {
    for (const definition of [bruteDefinition(0), bruteDefinition(10081), bruteDefinition(1.5), bruteDefinition(5, 0), { ...bruteDefinition(), parameters: { windowMinutes: '5', minimumCount: 2 } }, { ...bruteDefinition(), failureConditions: [{ path: 'EventID', operator: 'regex', value: '[' }] }, { ...bruteDefinition(), script: 'arbitrary' }]) {
        const response = reply()
        await putMillRule(request(bruteId, { ...edit, definition }), response as any)
        expect(response.statusCode).toBe(400)
    }
    expect(rows).toHaveLength(0)
    expect(audits).toHaveLength(0)
})

test('password spray honors the saved distinct-user threshold, window and event selector', async () => {
    const id = 'auth.password_spray'
    const definition = { match: 'all', parameters: { windowMinutes: 2, minimumCount: 2 }, conditions: [{ path: 'EventID', operator: 'equals', value: '4625' }] }
    await putMillRule(request(id, { ...edit, definition }), reply() as any)
    await ingest([login(1, 'failure', 4625, { source: { ip: '192.0.2.1' } }), login(2, 'failure', 4625, { source: { ip: '192.0.2.1' }, user: { id: 'bob' } })])
    expect(findings.filter(row => row.ruleId === `${id}.v1`)).toHaveLength(1)
    findings = []
    await ingest([login(5, 'failure', 4625, { source: { ip: '192.0.2.1' }, user: { id: 'charlie' } })])
    expect(findings.filter(row => row.ruleId === `${id}.v1`)).toHaveLength(0)
})

test('built-in network event selector gates findings and survives enable/disable', async () => {
    await putMillRule(request(builtin, { ...edit, definition: { match: 'all', conditions: [{ path: 'signature', operator: 'equals', value: 'Other' }], parameters: {} } }), reply() as any)
    await ingestMill(request('', network), reply() as any)
    expect(findings).toHaveLength(0)
    await postMillRuleAction(request(builtin, { action: 'disable' }), reply() as any)
    await postMillRuleAction(request(builtin, { action: 'enable' }), reply() as any)
    expect((await getMillRule(request(), reply() as any)).rule.definition.conditions[0].value).toBe('Other')
    await ingestMill(request('', network), reply() as any)
    expect(findings).toHaveLength(0)
})

test('custom Analyze rules drop before storage and retain audited Store exceptions', async () => {
    const body = { name: 'Drop network noise', explanation: 'Discard matching routine network events.', severity: 'low', stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'network' }] }
    const denied = reply()
    await postMillRule(request('', body), denied as any)
    expect(denied.statusCode).toBe(403)
    systemAdmin = true
    const created = await postMillRule(request('', body), reply() as any)
    expect(created.rule.definition).toMatchObject({ stage: 'analyze', action: 'drop' })
    expect(await ingestMill(request('', network), reply() as any)).toMatchObject({ accepted_events: 1, stored_events: 0, dropped_events: 1 })
    expect(events).toHaveLength(0)
    expect(findings).toHaveLength(0)
    await putMillRule(request(created.rule.id, { ...body, enabled: true, version: '1', action: 'keep' }), reply() as any)
    expect(rows[0].definition).toMatchObject({ stage: 'analyze', action: 'keep' })
    expect(audits.at(-1).context.after.definition.action).toBe('keep')
    expect(await ingestMill(request('', network), reply() as any)).toMatchObject({ stored_events: 1, dropped_events: 0 })
    expect(findings.some(finding => finding.ruleId === created.rule.id)).toBe(false)
    await postMillRule(request('', body), reply() as any)
    expect((await ingestMill(request('', network), reply() as any)).dropped_events).toBe(0)
    const outside = reply()
    await postMillRule(request('', body, 'org-b'), outside as any)
    expect(outside.statusCode).toBe(403)
})

test('custom action validation and disabling restores storage', async () => {
    systemAdmin = true
    const body = { name: 'Drop network', explanation: 'Discard network events matching this selector.', severity: 'low', stage: 'analyze', action: 'drop', conditions: [{ path: 'event_type', operator: 'equals', value: 'network' }] }
    for (const change of [{ stage: 'match' }, { stage: 'invalid' }, { action: 'invalid' }, { conditions: [] }]) {
        const result = reply()
        await postMillRule(request('', { ...body, ...change }), result as any)
        expect(result.statusCode).toBe(400)
    }
    const created = await postMillRule(request('', body), reply() as any)
    await postMillRuleAction(request(created.rule.id, { action: 'disable' }), reply() as any)
    expect((await ingestMill(request('', network), reply() as any)).dropped_events).toBe(0)
})
