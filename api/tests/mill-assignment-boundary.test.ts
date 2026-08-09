import { expect, mock, test } from 'bun:test'

const queries: string[] = []

mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'analyst-a' }) }))
mock.module('#utils/adminAudit.ts', () => ({ recordAdminAuditEvent: async () => undefined }))
mock.module('#db', () => ({
    default: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('FROM organizations')) return { rows: [{ id: 'org-a', role: 'owner' }] }
        if (sql.includes('FROM organization_members')) return { rows: [] }
        throw new Error('finding update should not run for a non-member assignee')
    },
}))

test('Mill finding assignment rejects a non-member before persistence', async () => {
    const { postMillFindingAction } = await import('../src/handlers/mill.ts')
    const response = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this },
        send(body: unknown) { return { status: this.statusCode, body } },
    }
    const result = await postMillFindingAction({
        query: { organizationId: 'org-a' },
        params: { id: 'finding-1' },
        body: { status: 'investigating', assigneeId: 'user-from-another-org' },
    } as never, response as never)

    expect(result).toEqual({ status: 422, body: { error: 'Assignee must be an active member of this organization.' } })
    expect(queries.some(sql => sql.includes('UPDATE mill_findings'))).toBe(false)
})
