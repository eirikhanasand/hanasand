import { requireVmAccess } from '#utils/vms/access.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import syncUserCertificatesToVm from '#utils/vms/syncUserCertificatesToVm.ts'
import recordLog from '#utils/logs/recordLog.ts'

const publicSshHost = process.env.VM_PUBLIC_SSH_HOST || process.env.VM_PUBLIC_HOST || 'hanasand.com'

export default async function getVmConnection(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id: rawVmName } = req.params as { id: string }
    const vmName = rawVmName?.trim()
    if (!vmName) {
        return res.status(400).send({ error: 'VM name is required.' })
    }

    if (!await requireVmAccess(req, res, vmName, false, true)) return

    try {
        const certificatesResult = await run(`
            SELECT DISTINCT c.id, c.name, c.public_key, c.created_at, c.created_by, c.owner
            FROM certificates c
            JOIN user_certificates uc ON uc.certificate_id = c.id
            WHERE uc.user_id = $1
            ORDER BY c.created_at DESC
        `, [id])

        // Access details use the same collected host metadata as the VM details panel.
        // An internal host credential failure must never become a website-session 401.
        const details = await run('SELECT device_eth0_ipv4_address FROM vm_details WHERE name = $1', [vmName])
        if (!details.rows.length) return res.status(503).send({ error: 'VM access details are being collected. Try again shortly.' })

        await syncUserCertificatesToVm({
            vmName,
            userIds: [id]
        }).catch((error) => {
            req.log.warn({ err: error, vmName, userId: id }, 'Unable to refresh user certificates on VM connection lookup.')
            void recordTerminalFailure(vmName, error)
        })

        const vmIp = typeof details.rows[0].device_eth0_ipv4_address === 'string' ? details.rows[0].device_eth0_ipv4_address : ''
        const username = vmName

        return res.send({
            vmName,
            vmIp,
            username,
            sshCommand: vmIp ? `ssh ${username}@${publicSshHost}` : null,
            certificateCount: certificatesResult.rows.length,
            certificates: certificatesResult.rows,
        })
    } catch (error) {
        req.log.error(error)
        void recordTerminalFailure(vmName, error)
        return res.status(500).send({ error: 'Unable to load VM connection details.' })
    }
}

async function recordTerminalFailure(vmName: string, error: unknown) {
    await recordLog({
        level: 'warn',
        message: `Terminal connection failed for ${vmName}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
            category: 'terminal_failure',
            vmName,
        },
    }).catch(() => {})
}
