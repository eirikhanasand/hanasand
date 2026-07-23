import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../_tiProxy'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const alertId = clean(body.alertId)
    const organizationId = clean(body.organizationId) || clean(body.orgId)
    const deliveryId = clean(body.deliveryId)
    if (deliveryId && organizationId) {
        const retryRequest = new NextRequest(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify({ organizationId, orgId: organizationId, tenantId: organizationId, deliveryId }),
        })
        return proxyOrganizationApiRequest(retryRequest, '/dwm/webhook-deliveries', { method: 'POST', timeoutMs: 20000 })
    }
    if (!alertId || !organizationId) {
        const passthrough = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(body) })
        return proxyTiRequest(passthrough, '/v1/dwm/webhooks/deliver', { method: 'POST' })
    }

    const reportRequest = thirdPartyReportRequest(body)
    if (reportRequest.error) {
        return Response.json({ error: { code: reportRequest.error.code, message: reportRequest.error.message } }, { status: reportRequest.error.status })
    }
    const alertRequestUrl = scopedUrl(request.url, organizationId)
    const alertResponse = await proxyTiRequest(new NextRequest(alertRequestUrl, { method: 'GET', headers: request.headers }), `/v1/dwm/alerts/${encodeURIComponent(alertId)}`, { method: 'GET' })
    if (!alertResponse.ok) return alertResponse
    const detail = await alertResponse.json() as Record<string, unknown>
    let alert = record(detail.alert) ?? detail
    if (reportRequest.value) {
        const reportUrl = scopedUrl(request.url, organizationId)
        reportUrl.searchParams.set('report', 'true')
        reportUrl.searchParams.set('format', reportRequest.value.format)
        for (const evidenceId of reportRequest.value.evidenceIds) reportUrl.searchParams.append('evidenceId', evidenceId)
        const reportResponse = await proxyTiRequest(
            new NextRequest(reportUrl, { method: 'GET', headers: request.headers }),
            `/v1/cases/${encodeURIComponent(reportRequest.value.caseId)}/export`,
            { method: 'GET' },
        )
        if (!reportResponse.ok) return reportResponse
        const report = await reportResponse.json() as Record<string, unknown>
        const checksum = clean(report.exportChecksum)
        if (!checksum) return Response.json({ error: { code: 'report_checksum_missing', message: 'The generated report has no export checksum.' } }, { status: 502 })
        const fetchedAlertId = clean(alert.id)
        const reportAlertId = clean(record(report.reportPolicy)?.alertId)
        if (!fetchedAlertId || fetchedAlertId !== alertId || !reportAlertId || reportAlertId !== fetchedAlertId) {
            return Response.json({ error: { code: 'report_case_alert_mismatch', message: 'The selected case report is not bound to the fetched alert.' } }, { status: 409 })
        }
        alert = {
            ...alert,
            caseId: reportRequest.value.caseId,
            report,
            dedupeKey: checksum,
            evidenceCount: reportRequest.value.evidenceIds.length,
        }
    }
    const deliveryRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
            ...body,
            alert,
            alertId,
            organizationId,
            orgId: organizationId,
            tenantId: organizationId,
            destinationId: reportRequest.value?.destinationId || clean(body.destinationId),
            dryRun: body.dryRun === true,
            live: body.live === true || body.dryRun !== true,
        }),
    })
    return proxyOrganizationApiRequest(deliveryRequest, '/dwm/webhook-deliveries', { method: 'POST', timeoutMs: 20000 })
}

function thirdPartyReportRequest(body: Record<string, unknown>): {
    value?: { caseId: string, evidenceIds: string[], format: 'json' | 'stix', destinationId: string }
    error?: { code: string, message: string, status: number }
} {
    const caseId = clean(body.caseId)
    const requested = Array.isArray(body.evidenceIds)
        ? body.evidenceIds.map(clean).filter(Boolean)
        : clean(body.evidenceId) ? [clean(body.evidenceId)] : []
    if (!caseId && !requested.length && !body.reportFormat) return {}
    if (!caseId) return { error: { code: 'report_case_required', message: 'caseId is required for third-party reporting.', status: 400 } }
    if (body.reportFormat !== undefined && body.reportFormat !== 'json' && body.reportFormat !== 'stix') {
        return { error: { code: 'unsupported_report_format', message: 'reportFormat must be json or stix.', status: 400 } }
    }
    if (new Set(requested).size !== requested.length) {
        return { error: { code: 'report_duplicate_evidence_selection', message: 'Each evidence row may be selected only once.', status: 400 } }
    }
    const evidenceIds = requested.sort()
    if (!evidenceIds.length) return { error: { code: 'report_evidence_required', message: 'Select at least one evidence row before delivery.', status: 400 } }
    if (evidenceIds.length > 25) return { error: { code: 'report_evidence_limit', message: 'A report may contain at most 25 evidence rows.', status: 413 } }
    const destinationId = clean(body.destinationId)
    if (!destinationId) return { error: { code: 'report_destination_required', message: 'Select one configured destination for third-party report delivery.', status: 400 } }
    const format = body.reportFormat === 'json' ? 'json' : 'stix'
    return { value: { caseId, evidenceIds, format, destinationId } }
}

function scopedUrl(url: string, organizationId: string) {
    const scoped = new URL(url)
    scoped.search = new URLSearchParams({ organizationId, tenantId: organizationId }).toString()
    return scoped
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
