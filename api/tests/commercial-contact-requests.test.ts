import { describe, expect, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { handleCommercialContactRequest, normalizeCommercialContactRequest } from '../src/handlers/commercialContactRequests.ts'

const body = {
    name: 'Avery Chen',
    email: 'avery@acme.test',
    company: 'Acme Security',
    subject: 'Monitoring access request',
    message: 'We need company and supplier monitoring with webhook delivery.',
    plan: 'monitoring',
    securityReview: true,
}

describe('commercial contact intake', () => {
    test('validates the commercial trust boundary', () => {
        expect(normalizeCommercialContactRequest({ ...body, email: 'not-an-email' })).toEqual({ ok: false, error: 'Use a valid email address.' })
        expect(normalizeCommercialContactRequest({ ...body, company: '' })).toEqual({ ok: false, error: 'Company is required for security review requests.' })
        expect(normalizeCommercialContactRequest({ ...body, subject: 'x'.repeat(301) })).toEqual({ ok: false, error: 'subject exceeds the 300 character limit.' })
        expect(normalizeCommercialContactRequest(body)).toMatchObject({ ok: true, input: { email: 'avery@acme.test', plan: 'monitoring', securityReview: true } })
    })

    test('stores once, notifies once, and rejects conflicting idempotent replays', async () => {
        const records = new Map<string, { ticketId: string, payloadHash: string, notificationStatus: string }>()
        let notifications = 0
        const dependencies = {
            persist: async (_input: unknown, key: string, payloadHash: string) => {
                const existing = records.get(key)
                if (existing) return { ...existing, receivedAt: '2026-07-22T10:00:00.000Z', inserted: false }
                const stored = { ticketId: 'HS-20260722-ABC12345', payloadHash, notificationStatus: 'pending' }
                records.set(key, stored)
                return { ...stored, receivedAt: '2026-07-22T10:00:00.000Z', inserted: true }
            },
            notify: async () => { notifications += 1 },
            markNotification: async () => undefined,
        }

        const first = await handleCommercialContactRequest(request(body), reply(), dependencies as any) as any
        expect(first.statusCode).toBe(202)
        expect(first.payload).toMatchObject({ accepted: true, ticketId: 'HS-20260722-ABC12345', delivery: 'notified', replayed: false })

        const replay = await handleCommercialContactRequest(request(body), reply(), dependencies as any) as any
        expect(replay.statusCode).toBe(200)
        expect(replay.payload).toMatchObject({ accepted: true, ticketId: 'HS-20260722-ABC12345', replayed: true })
        expect(notifications).toBe(1)

        const conflict = await handleCommercialContactRequest(request({ ...body, subject: 'Different request' }), reply(), dependencies as any) as any
        expect(conflict.statusCode).toBe(409)
        expect(conflict.payload.code).toBe('idempotency_conflict')
        expect(notifications).toBe(1)
    })

    test('keeps a stored request accepted when notification fails', async () => {
        const result = await handleCommercialContactRequest(request(body, 'contact-request-failure-0001'), reply(), {
            persist: async (_input, _key, payloadHash) => ({
                ticketId: 'HS-20260722-FAILED01',
                receivedAt: '2026-07-22T10:00:00.000Z',
                payloadHash,
                notificationStatus: 'pending',
                inserted: true,
            }),
            notify: async () => { throw new Error('SMTP unavailable') },
            markNotification: async () => undefined,
        } as any) as any
        expect(result.statusCode).toBe(202)
        expect(result.payload).toMatchObject({ accepted: true, delivery: 'stored' })
    })
})

function request(value: typeof body, idempotencyKey = 'contact-request-identity-0001') {
    return {
        id: 'request-1',
        body: value,
        headers: { 'idempotency-key': idempotencyKey },
        log: { error() {}, warn() {} },
    } as unknown as FastifyRequest<{ Body: typeof body }>
}

function reply() {
    return {
        statusCode: 200,
        headers: {} as Record<string, string>,
        status(code: number) { this.statusCode = code; return this },
        header(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this },
        send(payload: unknown) { return { statusCode: this.statusCode, headers: this.headers, payload } },
    } as unknown as FastifyReply
}
