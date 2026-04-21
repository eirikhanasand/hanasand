import dns from 'node:dns/promises'
import net from 'node:net'
import tls from 'node:tls'
import type { MailHealth, MailHealthCheck } from './types.ts'
import { mailConfig } from './config.ts'
import { fetchMailQueueSummary } from './stalwartAdmin.ts'

export async function getMailHealth(): Promise<MailHealth> {
    const checkedAt = new Date().toISOString()
    const checks: MailHealthCheck[] = []
    let queueDepth = 0
    let smtpBannerLatencyMs: number | null = null
    const internalMailHost = new URL(mailConfig.internalUrl).hostname

    const hostRecords = await resolvePublicDns(mailConfig.host, 'A')
    const primaryIp = hostRecords[0] || null
    const reverseRecords = primaryIp ? await resolvePublicDns(primaryIp, 'PTR') : []
    const ptrMatches = reverseRecords.some(value => normalizeDnsName(value) === normalizeDnsName(mailConfig.host))

    checks.push({
        id: 'ptr',
        label: 'Reverse DNS',
        status: primaryIp && ptrMatches ? 'healthy' : 'error',
        detail: primaryIp
            ? `${primaryIp} -> ${reverseRecords[0] || 'missing'}`
            : 'No A record found for the mail host.',
    })

    const spf = await resolvePublicDns(mailConfig.domain, 'TXT')
    const dmarc = await resolvePublicDns(`_dmarc.${mailConfig.domain}`, 'TXT')
    const mtaStsTxt = await resolvePublicDns(`_mta-sts.${mailConfig.domain}`, 'TXT')
    const tlsRpt = await resolvePublicDns(`_smtp._tls.${mailConfig.domain}`, 'TXT')
    const mtaStsPolicy = await safeFetchText(`https://mta-sts.${mailConfig.domain}/.well-known/mta-sts.txt`)

    checks.push({
        id: 'spf',
        label: 'SPF',
        status: spf.some(value => value.startsWith('v=spf1')) ? 'healthy' : 'warning',
        detail: spf[0] || 'Missing SPF TXT record.',
    })
    checks.push({
        id: 'dmarc',
        label: 'DMARC',
        status: dmarc.some(value => value.startsWith('v=DMARC1')) ? 'healthy' : 'warning',
        detail: dmarc[0] || 'Missing DMARC TXT record.',
    })
    checks.push({
        id: 'mta-sts',
        label: 'MTA-STS',
        status: hasValidMtaSts(mtaStsTxt, mtaStsPolicy) ? 'healthy' : 'warning',
        detail: mtaStsTxt[0] || 'Missing MTA-STS TXT record.',
    })
    checks.push({
        id: 'tlsrpt',
        label: 'TLS-RPT',
        status: tlsRpt.some(value => value.startsWith('v=TLSRPTv1')) ? 'healthy' : 'warning',
        detail: tlsRpt[0] || 'Missing TLS reporting TXT record.',
    })

    smtpBannerLatencyMs = await measureSmtpBannerLatency(internalMailHost, 25)
    checks.push({
        id: 'smtp-banner',
        label: 'SMTP banner',
        status: smtpBannerLatencyMs !== null && smtpBannerLatencyMs < 2000 ? 'healthy' : 'warning',
        detail: smtpBannerLatencyMs === null ? 'Unable to measure port 25 greeting.' : `${smtpBannerLatencyMs}ms`,
    })

    const certificateInfo = await inspectImplicitTls(internalMailHost, mailConfig.imapPort, mailConfig.host)
    checks.push({
        id: 'tls-cert',
        label: 'TLS certificate',
        status: certificateInfo.status,
        detail: certificateInfo.detail,
    })

    try {
        const queue = await fetchMailQueueSummary()
        queueDepth = queue.data?.total || 0
    } catch {
        queueDepth = -1
    }

    checks.push({
        id: 'queue',
        label: 'Queue depth',
        status: queueDepth === 0 ? 'healthy' : queueDepth > 0 ? 'warning' : 'warning',
        detail: queueDepth >= 0 ? `${queueDepth} queued message(s)` : 'Unable to query the outbound queue.',
    })

    return {
        status: summarize(checks),
        checkedAt,
        queueDepth: Math.max(queueDepth, 0),
        smtpBannerLatencyMs,
        checks,
    }
}

async function resolvePublicDns(name: string, type: 'A' | 'TXT' | 'PTR') {
    try {
        const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
            signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) {
            return []
        }

        const payload = await response.json() as {
            Answer?: Array<{ data?: string }>
        }

        return (payload.Answer || [])
            .map(answer => (answer.data || '').replace(/^"|"$/g, ''))
            .map(answer => answer.endsWith('.') ? answer.slice(0, -1) : answer)
            .map(answer => answer.replace(/" "/g, ''))
    } catch {
        if (type === 'A') {
            try {
                return await dns.resolve4(name)
            } catch {
                return []
            }
        }

        if (type === 'PTR') {
            try {
                return await dns.reverse(name)
            } catch {
                return []
            }
        }

        try {
            const records = await dns.resolveTxt(name)
            return records.map(parts => parts.join(''))
        } catch {
            return []
        }
    }
}

async function safeFetchText(url: string) {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            return ''
        }

        return await response.text()
    } catch {
        return ''
    }
}

function hasValidMtaSts(records: string[], policy: string) {
    return records.some(value => value.startsWith('v=STSv1'))
        && policy.includes('version: STSv1')
        && policy.includes(`mx: ${mailConfig.host}`)
}

function normalizeDnsName(value: string) {
    return value.replace(/\.$/, '').toLowerCase()
}

function measureSmtpBannerLatency(host: string, port: number) {
    return new Promise<number | null>((resolve) => {
        const startedAt = Date.now()
        const socket = net.createConnection({ host, port })
        let settled = false

        const finish = (value: number | null) => {
            if (settled) {
                return
            }

            settled = true
            socket.destroy()
            resolve(value)
        }

        socket.setTimeout(10_000)
        socket.once('data', () => finish(Date.now() - startedAt))
        socket.once('timeout', () => finish(null))
        socket.once('error', () => finish(null))
    })
}

function inspectImplicitTls(host: string, port: number, servername: string) {
    return new Promise<{ status: 'healthy' | 'warning' | 'error', detail: string }>((resolve) => {
        const socket = tls.connect({
            host,
            port,
            servername,
            rejectUnauthorized: true,
        }, () => {
            const certificate = socket.getPeerCertificate()
            const validTo = certificate.valid_to ? new Date(certificate.valid_to) : null
            const daysLeft = validTo ? Math.ceil((validTo.getTime() - Date.now()) / 86_400_000) : null
            socket.end()

            if (!validTo || daysLeft === null) {
                resolve({ status: 'warning', detail: 'Certificate is present, but expiry could not be determined.' })
                return
            }

            resolve({
                status: daysLeft > 14 ? 'healthy' : daysLeft > 0 ? 'warning' : 'error',
                detail: `${certificate.subject?.CN || host} expires in ${daysLeft} day(s)`,
            })
        })

        socket.setTimeout(10_000, () => {
            socket.destroy()
            resolve({ status: 'error', detail: `Unable to complete TLS handshake on port ${port}.` })
        })
        socket.once('error', () => resolve({ status: 'error', detail: `Unable to complete TLS handshake on port ${port}.` }))
    })
}

function summarize(checks: MailHealthCheck[]): MailHealth['status'] {
    if (checks.some(check => check.status === 'error')) {
        return 'error'
    }

    if (checks.some(check => check.status === 'warning')) {
        return 'warning'
    }

    return 'healthy'
}
