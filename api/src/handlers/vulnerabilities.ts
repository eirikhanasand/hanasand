import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { getVulnerabilityReport, startTrackedVulnerabilityScan } from '#utils/vulnerabilities/scanner.ts'
import { getWebScanReport, setWebScanSchedule, startWebScan } from '#utils/vulnerabilities/webScanner.ts'

async function requireSystemAdmin(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        res.status(401).send({ error: 'Unauthorized.' })
        return false
    }
    const role = await hasRole(req, res, 'system_admin')
    if (!role.valid) {
        res.status(403).send({ error: 'System administrator access is required.' })
        return false
    }
    return true
}

export async function getVulnerabilities(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    return res.send(await getVulnerabilityReport())
}

export async function postVulnerabilityScan(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    void startTrackedVulnerabilityScan().catch(error => {
        console.error('Failed to run vulnerability scanner from dashboard', error)
    })
    const report = await getVulnerabilityReport()
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
    if (!await requireSystemAdmin(req, res)) return
    void startWebScan().catch(error => console.error('Failed to run Hanasand web scanner', error))
    return res.status(202).send({ message: 'Hanasand safe web scan started.', status: await getWebScanReport() })
}

export async function putWebScannerSchedule(req: FastifyRequest, res: FastifyReply) {
    if (!await requireSystemAdmin(req, res)) return
    const body = req.body as { enabled?: unknown, intervalMinutes?: unknown } | undefined
    const intervalMinutes = body?.intervalMinutes === undefined ? undefined : Number(body.intervalMinutes)
    if (intervalMinutes !== undefined && (!Number.isFinite(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 1440)) return res.status(400).send({ error: 'Scan interval must be between 5 and 1,440 minutes.' })
    return res.send(await setWebScanSchedule({ enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined, intervalMinutes }))
}
