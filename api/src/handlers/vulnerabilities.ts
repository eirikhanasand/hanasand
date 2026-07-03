import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { getVulnerabilityReport, startTrackedVulnerabilityScan } from '#utils/vulnerabilities/scanner.ts'

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
