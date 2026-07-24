import { describe, expect, test } from 'bun:test'
import { canonicalThirdPartyReportForDelivery } from '../src/handlers/dwm/webhooks.ts'
import { assertPublicWebhookTarget, buildDwmAlertDeliveryPayload, computeOutboundThirdPartyReportChecksum, normalizeDwmWebhookDestinationInput, pinnedWebhookLookup, signDwmWebhookDeliveryBody, validateDwmWebhookReceiverEnvelope, validateOutboundThirdPartyReport } from '../src/utils/dwm/webhooks.ts'
import { canonicalJson, containsUnsafeCustomerOutboundText, sanitizeCustomerOutboundText } from '../src/utils/dwm/customerOutputSafety.ts'
import { webhookHeaders } from '../../ti/scraper/src/api/organizationRoutes.ts'

describe('DWM webhook network boundary', () => {
    test('rejects local and private literal destinations before encryption', () => {
        for (const endpointUrl of [
            'https://localhost/hook',
            'https://127.0.0.1/hook',
            'https://10.0.0.1/hook',
            'https://169.254.169.254/latest/meta-data',
            'https://[::1]/hook',
            'https://[::ffff:7f00:1]/hook',
            'https://user:pass@example.com/hook',
        ]) {
            expect(() => normalizeDwmWebhookDestinationInput({ endpointUrl }, 'owner')).toThrow()
        }
    })

    test('rejects private DNS answers and accepts a public pinned target', async () => {
        const privateResolver = async () => [{ address: '10.0.0.2', family: 4 }]
        const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }]

        await expect(assertPublicWebhookTarget('https://hooks.example.com/alerts', privateResolver)).rejects.toThrow('private network')
        await expect(assertPublicWebhookTarget('https://hooks.example.com/alerts', publicResolver)).resolves.toBe('https://hooks.example.com/alerts')
    })

    test('returns pinned addresses in the shape requested by Node HTTPS', async () => {
        const pinned = pinnedWebhookLookup([
            { address: '2001:db8::10', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ])
        const all = await new Promise<unknown>((resolve, reject) => pinned('hooks.example.com', { all: true }, (error, result) => error ? reject(error) : resolve(result)))
        const ipv4 = await new Promise<unknown>((resolve, reject) => pinned('hooks.example.com', { family: 4 }, (error, result) => error ? reject(error) : resolve(result)))

        expect(all).toEqual([
            { address: '2001:db8::10', family: 6 },
            { address: '93.184.216.34', family: 4 },
        ])
        expect(ipv4).toBe('93.184.216.34')
    })

    test('preserves scraper evidence excerpts and observation timestamps', () => {
        const payload = buildDwmAlertDeliveryPayload({
            destination: { id: 'destination_1', kind: 'webhook', name: 'Customer receiver', org_id: 'org_1' },
            eventType: 'dwm.alert.created',
            deliveryId: 'delivery_1',
            alert: {
                id: 'alert_1',
                title: 'APT29 source mention',
                severity: 'low',
                matchedTerm: { value: 'APT29', kind: 'actor' },
                firstSeenAt: '2026-07-21T07:15:42.826Z',
                evidence: [{
                    sourceName: 'Public threat report',
                    excerpt: 'Public reporting attributes the activity to APT29.',
                    observedAt: '2026-07-21T07:15:42.826Z',
                }],
            },
        }) as any

        expect(payload.alert.evidence).toEqual([{
            label: 'Evidence',
            detail: 'Public reporting attributes the activity to APT29.',
            source: 'Public threat report',
            capturedAt: '2026-07-21T07:15:42.826Z',
        }])
        expect(payload.alert.evidenceTimestamp).toBe('2026-07-21T07:15:42.826Z')
    })

    test('preserves one bounded validated report and keys delivery idempotency to its checksum', () => {
        const report = reportFixture()
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_1', alertId: 'alert_1', dedupeKey: report.exportChecksum })).toMatchObject({ valid: true, report })
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_other', alertId: 'alert_1', dedupeKey: report.exportChecksum })).toMatchObject({ valid: false })
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_1', alertId: 'alert_other', dedupeKey: report.exportChecksum })).toMatchObject({ valid: false })
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_1', alertId: 'alert_1', dedupeKey: 'other_checksum' })).toMatchObject({ valid: false })
        const payload = buildDwmAlertDeliveryPayload({
            destination: { id: 'destination_report', kind: 'webhook', name: 'External receiver', org_id: 'org_1' },
            eventType: 'dwm.alert.updated',
            deliveryId: 'delivery_report',
            alert: {
                id: 'alert_1',
                tenantId: 'org_1',
                dedupeKey: report.exportChecksum,
                title: 'Evidence-backed case report',
                firstSeenAt: '2026-07-23T10:00:00.000Z',
                report,
            },
        }) as any
        expect(payload.report).toEqual(report)
        expect(payload.idempotencyKey).toContain(report.exportChecksum)
        const missingPublished = withReportChecksum({
            ...report,
            bundle: {
                ...(report.bundle as Record<string, unknown>),
                objects: (report.bundle as { objects: Array<Record<string, unknown>> }).objects.map(object => object.type === 'report'
                    ? Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'published'))
                    : object),
            },
        })
        expect(validateOutboundThirdPartyReport(missingPublished)).toMatchObject({ valid: false, error: 'STIX report published must be a valid timestamp.' })
        expect(validateOutboundThirdPartyReport({ ...report, body: 'raw evidence' })).toMatchObject({ valid: false })
        expect(validateOutboundThirdPartyReport({ ...report, reportPolicy: { ...report.reportPolicy, evidenceCount: 26 } })).toMatchObject({ valid: false })
        for (const unsafe of [
            'hiddenservice.onion/path',
            'hiddenservice.i2p/path',
            'https://t.me/source_contact',
            'operator@criminal.example',
            '@operator_handle',
            'telegram: attacker_handle',
            'token=secret-value',
            '+47 912 34 567',
            '1:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '12345678:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '12345678901:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '12345678901234567890123456789012:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '1234567890123456789012345678901234567890:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            'https://telegram.dog/source_contact',
            'api_key=APIKEYSECRET123',
            'key=KEYSECRET123456',
            'access_token=ACCESSSECRET123',
            'refresh_token=REFRESHSECRET123',
            'client_secret=CLIENTSECRET123',
            'private_key=PRIVATEKEYSECRET123',
            'password=PASSWORDSECRET123',
            'passwd=PASSWDSECRET123',
            'session_string=SESSIONSECRET123',
            'authorization=AUTHSECRET123',
            'cookie=COOKIESECRET123',
            'Bearer BEARERSECRET123',
            'Basic BASICSECRET123',
            'sk_CREDENTIALSECRET123456789',
        ]) {
            for (const format of ['stix', 'json'] as const) {
                const changed = withReportChecksum({ ...reportFixture(format), note: unsafe })
                expect(validateOutboundThirdPartyReport(changed)).toMatchObject({ valid: false })
                const sanitized = sanitizeCustomerOutboundText(unsafe)
                expect(sanitized).not.toContain(unsafe)
                expect(containsUnsafeCustomerOutboundText(sanitized)).toBe(false)
                expect(validateOutboundThirdPartyReport(withReportChecksum({ ...reportFixture(format), note: sanitized }))).toMatchObject({ valid: true })
            }
        }
    })

    test('binds a durable receiver receipt to the exact report payload and delivery lineage', () => {
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        const previousReceiverUrls = process.env.DWM_CONTROLLED_RECEIVER_URLS
        const receiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'receiver-signature-test'
        process.env.DWM_CONTROLLED_RECEIVER_URLS = receiverUrl
        const report = reportFixture()
        const payload = buildDwmAlertDeliveryPayload({
            destination: { id: 'destination_report', kind: 'webhook', name: 'External receiver', org_id: 'org_1' },
            eventType: 'dwm.alert.updated',
            deliveryId: 'delivery_report',
            alert: {
                id: 'alert_1',
                tenantId: 'org_1',
                dedupeKey: report.exportChecksum,
                title: 'Evidence-backed case report',
                firstSeenAt: '2026-07-23T10:00:00.000Z',
                report,
            },
        })
        const envelopeFor = (candidate: Record<string, unknown>) => ({
            eventId: 'receiver_event_1',
            receivedAt: '2026-07-24T10:00:00.000Z',
            payload: candidate,
            signature: signDwmWebhookDeliveryBody(canonicalJson(candidate), receiverUrl),
        })
        try {
            const envelope = envelopeFor(payload)
            const first = validateDwmWebhookReceiverEnvelope(envelope)
            const replay = validateDwmWebhookReceiverEnvelope(envelope)
            expect(first).toMatchObject({
                valid: true,
                receipt: {
                    orgId: 'org_1',
                    destinationId: 'destination_report',
                    deliveryId: 'delivery_report',
                    reportValidation: 'valid',
                    reportCaseId: 'case_1',
                    reportAlertId: 'alert_1',
                    reportExportChecksum: report.exportChecksum,
                },
            })
            expect(replay).toEqual(first)
            expect(validateDwmWebhookReceiverEnvelope({ ...envelope, signature: 'sha256=forged' })).toMatchObject({
                valid: false,
                error: 'Receiver payload signature is invalid.',
            })
            expect(validateDwmWebhookReceiverEnvelope({
                ...envelope,
                signature: signDwmWebhookDeliveryBody(canonicalJson(payload), 'https://external.example/report'),
            })).toMatchObject({
                valid: false,
                error: 'Receiver payload signature is invalid.',
            })

            const wrongScope = {
                ...payload,
                org: { ...payload.org, id: 'org_other', tenantId: 'org_other' },
            }
            expect(validateDwmWebhookReceiverEnvelope(envelopeFor(wrongScope))).toMatchObject({
                valid: false,
                error: 'report organization does not match delivery scope.',
            })
            expect(validateDwmWebhookReceiverEnvelope(envelopeFor({
                ...payload,
                report: { ...report, body: 'raw evidence' },
            }))).toMatchObject({ valid: false })
        } finally {
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
            restoreEnv('DWM_CONTROLLED_RECEIVER_URLS', previousReceiverUrls)
        }
    })

    test('verifies every scraper legacy producer with its exact serialized body and lineage', () => {
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        const previousReceiverUrls = process.env.DWM_CONTROLLED_RECEIVER_URLS
        const receiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'receiver-signature-test'
        process.env.DWM_CONTROLLED_RECEIVER_URLS = receiverUrl
        const base = {
            organizationId: 'org_1',
            tenantId: 'org_1',
            webhookDestinationId: 'destination_1',
            generatedAt: '2026-07-24T10:00:00.000Z',
        }
        const payloads = [
            {
                ...base,
                eventType: 'organization.webhook.test',
                deliveryId: 'organization_delivery_1',
                idempotencyKey: 'organization_delivery_1',
            },
            {
                ...base,
                eventType: 'darkweb.monitoring.test',
                deliveryId: 'dwm_test_delivery_1',
                idempotencyKey: 'dwm_test_delivery_1',
            },
            {
                ...base,
                eventType: 'darkweb.monitoring.match',
                deliveryId: 'dwm_match_delivery_1',
                idempotencyKey: 'dwm_match_lineage_1',
            },
        ]
        try {
            for (const payload of payloads) {
                const payloadBody = JSON.stringify(payload)
                const headers = new Headers(webhookHeaders(
                    payload.eventType,
                    payload.deliveryId,
                    payload.idempotencyKey,
                    receiverUrl,
                    payloadBody
                ))
                expect(validateDwmWebhookReceiverEnvelope({
                    eventId: payload.deliveryId,
                    receivedAt: '2026-07-24T10:00:01.000Z',
                    payload,
                    payloadBody,
                    deliveryId: headers.get('x-hanasand-delivery-id'),
                    idempotencyKey: headers.get('x-hanasand-dedupe-key'),
                    signature: headers.get('x-hanasand-delivery-signature'),
                })).toMatchObject({
                    valid: true,
                    receipt: {
                        orgId: 'org_1',
                        destinationId: 'destination_1',
                        deliveryId: payload.deliveryId,
                        idempotencyKey: payload.idempotencyKey,
                    },
                })
            }
            const payload = payloads[0]
            const payloadBody = JSON.stringify(payload)
            const signature = new Headers(webhookHeaders(
                payload.eventType,
                payload.deliveryId,
                payload.idempotencyKey,
                receiverUrl,
                payloadBody
            )).get('x-hanasand-delivery-signature')
            expect(validateDwmWebhookReceiverEnvelope({
                receivedAt: '2026-07-24T10:00:01.000Z',
                payload,
                payloadBody: JSON.stringify({ ...payload, tenantId: 'org_other' }),
                signature,
            })).toMatchObject({
                valid: false,
                error: 'Receiver serialized payload does not match its parsed payload.',
            })
        } finally {
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
            restoreEnv('DWM_CONTROLLED_RECEIVER_URLS', previousReceiverUrls)
        }
    })

    test('keeps idempotency stable per event while allowing created, updated, and replayed delivery', () => {
        const destination = { id: 'destination_1', kind: 'webhook' as const, name: 'External receiver', org_id: 'org_1' }
        const alert = {
            id: 'alert_1',
            tenantId: 'org_1',
            dedupeKey: 'same_report_checksum',
            title: 'Evidence-backed case report',
            firstSeenAt: '2026-07-23T10:00:00.000Z',
        }
        const created = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.created' }) as any
        const duplicateCreated = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.created' }) as any
        const updated = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.updated' }) as any
        const replayed = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.replayed' }) as any

        expect(created.idempotencyKey).toBe(duplicateCreated.idempotencyKey)
        expect(new Set([created.idempotencyKey, updated.idempotencyKey, replayed.idempotencyKey]).size).toBe(3)
        expect(created.idempotencyKey).toContain('dwm.alert.created')
        expect(updated.idempotencyKey).toContain('dwm.alert.updated')
        expect(replayed.idempotencyKey).toContain('dwm.alert.replayed')
    })

    test('rejects duplicate and non-canonical evidence selection before checksum delivery', () => {
        const report = reportFixture('json')
        const duplicate = withReportChecksum({
            ...report,
            evidence: [{ id: 'evidence_1' }, { id: 'evidence_1' }],
            reportPolicy: { ...report.reportPolicy, evidenceIds: ['evidence_1', 'evidence_1'], evidenceCount: 2 },
        })
        expect(validateOutboundThirdPartyReport(duplicate)).toMatchObject({ valid: false })

        const unordered = withReportChecksum({
            ...report,
            evidence: [{ id: 'evidence_2' }, { id: 'evidence_1' }],
            reportPolicy: { ...report.reportPolicy, evidenceIds: ['evidence_2', 'evidence_1'], evidenceCount: 2 },
        })
        expect(validateOutboundThirdPartyReport(unordered)).toMatchObject({ valid: false, error: 'report evidenceIds must use canonical order.' })
    })

    test('rejects a self-consistent caller-forged report when canonical TI checksum differs', async () => {
        const canonical = reportFixture()
        const forged = withReportChecksum({
            ...canonical,
            bundle: {
                ...canonical.bundle,
                objects: canonical.bundle.objects.map(item => item.type === 'report' ? { ...item, name: 'Caller-forged conclusion' } : item),
            },
        })
        const previousBase = process.env.TI_SCRAPER_API_BASE
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_API_BASE = 'https://ti.internal.test'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        try {
            const requests: Request[] = []
            const result = await canonicalThirdPartyReportForDelivery({
                submittedReport: forged,
                organizationId: 'org_1',
                alertId: 'alert_1',
                dedupeKey: forged.exportChecksum,
                actorId: 'user_1',
                authorization: 'Bearer session',
            }, async (input, init) => {
                requests.push(new Request(input, init))
                return Response.json(canonical)
            })
            expect(result).toMatchObject({ status: 409, code: 'third_party_report_checksum_mismatch' })
            expect(requests[0].url).toContain('/v1/cases/case_1/export?')
            expect(requests[0].url).toContain('organizationId=org_1')
            expect(requests[0].url).toContain('alertId=alert_1')
            expect(requests[0].url).toContain('evidenceId=evidence_1')
            expect(requests[0].headers.get('x-hanasand-service-token')).toBe('service-secret')
        } finally {
            restoreEnv('TI_SCRAPER_API_BASE', previousBase)
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
        }
    })

    test('rejects a canonical TI response whose payload no longer matches its checksum', async () => {
        const submitted = reportFixture()
        const changedCanonical = {
            ...submitted,
            bundle: {
                ...submitted.bundle,
                objects: submitted.bundle.objects.map(item => item.type === 'report' ? { ...item, name: 'Changed after checksum' } : item),
            },
        }
        const previousBase = process.env.TI_SCRAPER_API_BASE
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_API_BASE = 'https://ti.internal.test'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        try {
            const result = await canonicalThirdPartyReportForDelivery({
                submittedReport: submitted,
                organizationId: 'org_1',
                alertId: 'alert_1',
                dedupeKey: submitted.exportChecksum,
                actorId: 'user_1',
            }, async () => Response.json(changedCanonical))
            expect(result).toMatchObject({ status: 502, code: 'canonical_third_party_report_invalid' })
        } finally {
            restoreEnv('TI_SCRAPER_API_BASE', previousBase)
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
        }
    })

    test('bounds canonical TI transport and payload failures without reflecting network detail', async () => {
        const submitted = reportFixture()
        const previousBase = process.env.TI_SCRAPER_API_BASE
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_API_BASE = 'https://ti.internal.test'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        const verify = (fetcher: typeof fetch) => canonicalThirdPartyReportForDelivery({
            submittedReport: submitted,
            organizationId: 'org_1',
            alertId: 'alert_1',
            dedupeKey: submitted.exportChecksum,
            actorId: 'user_1',
        }, fetcher)
        try {
            const unavailable = await verify(async () => {
                throw new Error('connect ECONNREFUSED private-ti.internal:9443')
            })
            expect(unavailable).toMatchObject({ status: 503, code: 'third_party_report_verification_unavailable' })
            expect(JSON.stringify(unavailable)).not.toContain('private-ti.internal')

            const nonJson = await verify(async () => new Response('<h1>proxy secret</h1>', { status: 200 }))
            expect(nonJson).toMatchObject({ status: 502, code: 'third_party_report_verification_unavailable' })
            expect(JSON.stringify(nonJson)).not.toContain('proxy secret')

            const invalidJson = await verify(async () => Response.json(null))
            expect(invalidJson).toMatchObject({ status: 502, code: 'third_party_report_verification_unavailable' })

            const upstreamFailure = await verify(async () => Response.json({ error: 'database host pg-secret.internal' }, { status: 503 }))
            expect(upstreamFailure).toMatchObject({ status: 502, code: 'third_party_report_verification_unavailable' })
            expect(JSON.stringify(upstreamFailure)).not.toContain('pg-secret.internal')
        } finally {
            restoreEnv('TI_SCRAPER_API_BASE', previousBase)
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
        }
    })
})

function reportFixture(format: 'stix' | 'json' = 'stix') {
    if (format === 'json') {
        return withReportChecksum({
            schemaVersion: 'analyst.case_export.v1',
            evidence: [{ id: 'evidence_1' }],
            reportPolicy: {
                direction: 'outbound_third_party',
                format: 'hanasand-json',
                caseId: 'case_1',
                alertId: 'alert_1',
                organizationId: 'org_1',
                evidenceIds: ['evidence_1'],
                evidenceCount: 1,
            },
        })
    }
    return withReportChecksum({
        bundle: {
            type: 'bundle',
            id: 'bundle--11111111-1111-4111-8111-111111111111',
            objects: [
                { type: 'identity', spec_version: '2.1', id: 'identity--11111111-1111-4111-8111-111111111111' },
                { type: 'x-ti-evidence', spec_version: '2.1', id: 'x-ti-evidence--11111111-1111-4111-8111-111111111111', x_ti_capture_id: 'capture_1', x_ti_source_id: 'source_1', x_ti_content_hash: 'hash_1' },
                { type: 'report', spec_version: '2.1', id: 'report--11111111-1111-4111-8111-111111111111', published: '2026-07-23T10:00:00.000Z', object_refs: ['x-ti-evidence--11111111-1111-4111-8111-111111111111'] },
            ],
        },
        reportPolicy: {
            direction: 'outbound_third_party',
            format: 'stix-2.1',
            caseId: 'case_1',
            alertId: 'alert_1',
            organizationId: 'org_1',
            evidenceIds: ['evidence_1'],
            evidenceCount: 1,
        },
        standardsValidation: { standard: 'STIX 2.1', valid: true, issues: [] },
    })
}

function withReportChecksum<T extends Record<string, any>>(value: T) {
    const report = { ...value }
    delete report.exportChecksum
    const reportPolicy = { ...report.reportPolicy }
    delete reportPolicy.exportChecksum
    const draft = { ...report, reportPolicy }
    const exportChecksum = computeOutboundThirdPartyReportChecksum(draft)
    return { ...draft, exportChecksum, reportPolicy: { ...reportPolicy, exportChecksum } }
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
}
