import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { getVulnerabilityReport, startTrackedVulnerabilityScan } from '#utils/vulnerabilities/scanner.ts'
import { getWebScanReport, setWebScanSchedule, startWebScan } from '#utils/vulnerabilities/webScanner.ts'
import { recordAdminAuditEvent } from '#utils/adminAudit.ts'

async function requireSystemAdmin(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        res.status(401).send({ error: 'Unauthorized.' })
        return false
    }
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        res.status(403).send({ error: 'System administrator access is required.' })
        return false
    }
    return id
}

export async function getVulnerabilities(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    return res.send(await getVulnerabilityReport())
}

export async function postVulnerabilityScan(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireSystemAdmin(req, res)
    if (!actorId) return
    void startTrackedVulnerabilityScan().catch(error => {
        console.error('Failed to run vulnerability scanner from dashboard', error)
    })
    const report = await getVulnerabilityReport()
    await recordAdminAuditEvent(req, {
        actionType: 'security_scanner.execution.started',
        actorId,
        targetType: 'vulnerability_scanner',
        targetId: 'container-images',
        context: { mode: 'manual' },
    })
    return res.send({
        message: 'Vulnerability scan started; refresh status for progress and blockers.',
        status: { ...report.scanStatus, isRunning: true },
    })
}

export async function getWebScanner(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    return res.send(await getWebScanReport())
}

export async function postWebScanner(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireSystemAdmin(req, res)
    if (!actorId) return
    void startWebScan().catch(error => console.error('Failed to run Hanasand web scanner', error))
    await recordAdminAuditEvent(req, {
        actionType: 'security_scanner.execution.started',
        actorId,
        targetType: 'security_scanner',
        targetId: 'hanasand-web',
        context: { mode: 'manual' },
    })
    return res.status(202).send({ message: 'Hanasand safe web scan started.', status: await getWebScanReport() })
}

export async function putWebScannerSchedule(req: FastifyRequest, res: FastifyReply) {
    const actorId = await requireSystemAdmin(req, res)
    if (!actorId) return
    const body = req.body as { enabled?: unknown, intervalMinutes?: unknown } | undefined
    const intervalMinutes = body?.intervalMinutes === undefined ? undefined : Number(body.intervalMinutes)
    if (intervalMinutes !== undefined && (!Number.isFinite(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 1440)) return res.status(400).send({ error: 'Scan interval must be between 5 and 1,440 minutes.' })
    const schedule = await setWebScanSchedule({ enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined, intervalMinutes })
    await recordAdminAuditEvent(req, {
        actionType: 'security_scanner.schedule.updated',
        actorId,
        targetType: 'security_scanner',
        targetId: 'hanasand-web',
        context: { enabled: schedule.enabled, intervalMinutes: schedule.intervalMinutes },
    })
    return res.send(schedule)
}
