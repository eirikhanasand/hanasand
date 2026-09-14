import { beforeEach, expect, mock, test } from 'bun:test'

let role = 'owner', valid = true, auditFailure = false
let rows: any[] = [], audits: any[] = [], findings: any[] = []
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
    if (sql.includes('FROM system_events')) return { rows: audits.filter(row => row.organization_id === p[0] && (row.object_id === p[1] || row.object_id === p[2])).slice(p[3], p[3] + 51) }
    if (sql.includes('INSERT INTO mill_events')) return { rows: [] }
    if (sql.includes('INSERT INTO mill_findings')) { findings.push({ organizationId: p[1], ruleId: p[3], severity: p[4], evidence: JSON.parse(p[6]) }); return { rows: [] } }
    throw new Error(`Unexpected query: ${sql}`)
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => {
    const beforeRows = structuredClone(rows), beforeAudit = structuredClone(audits)
    try { return await work(query) } catch (error) { rows = beforeRows; audits = beforeAudit; throw error }
} }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid, id: 'editor' }) }))
mock.module('#utils/auth/apiKeys.ts', () => ({ validateApiKey: async () => ({ organizationId: 'org-a', apiKey: { scopes: [] } }), matchApiKeyScope: () => true }))
const { getMillRule, putMillRule, postMillRuleAction, postMillRule, postMillRulePack, ingestMill } = await import('../src/handlers/mill.ts')
const builtin = 'network.signature_alert.v1'
const reply = () => ({ statusCode: 200, status(code: number) { this.statusCode = code; return this }, send(body: any) { return body } })
const request = (id = builtin, body: any = {}, organizationId = 'org-a') => ({ params: { id }, query: { organizationId }, body, ip: '127.0.0.1', headers: { authorization: 'Bearer test-key' }, id: 'request-test' }) as any
const edit = { version: '1', name: 'Custom network alert', explanation: 'An important signature matched a network event.', severity: 'critical', enabled: true }
const network = { source: {}, events: [{ timestamp: '2026-09-14T12:00:00Z', event_type: 'network', action: 'alert', signature: 'Test signature' }] }
beforeEach(() => { rows = []; audits = []; findings = []; role = 'owner'; valid = true; auditFailure = false })

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
    const detail = await getMillRule(request(id), reply() as any)
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
