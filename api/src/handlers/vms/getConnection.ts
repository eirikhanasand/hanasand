import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import config from '#constants'
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

    try {
        const certificatesResult = await run(`
            SELECT DISTINCT c.id, c.name, c.public_key, c.created_at, c.created_by, c.owner
            FROM certificates c
            JOIN user_certificates uc ON uc.certificate_id = c.id
            WHERE uc.user_id = $1
            ORDER BY c.created_at DESC
        `, [id])

        const vmResponse = await fetch(`${config.internal_api}/vm/${encodeURIComponent(vmName)}`, {
            headers: {
                'Authorization': `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_api',
            },
        })

        const vmPayload = await vmResponse.json().catch(() => ({} as { vm_ip?: string }))
        if (!vmResponse.ok) {
            if (!isExpectedVmLookupMiss(vmResponse.status)) {
                void recordTerminalFailure(vmName, `Internal VM lookup returned ${vmResponse.status}.`)
            }
            return res.status(vmResponse.status).send(vmPayload)
        }

        await syncUserCertificatesToVm({
            vmName,
            userIds: [id]
        }).catch((error) => {
            req.log.warn({ err: error, vmName, userId: id }, 'Unable to refresh user certificates on VM connection lookup.')
            void recordTerminalFailure(vmName, error)
        })

        const vmIp = typeof vmPayload.vm_ip === 'string' ? vmPayload.vm_ip : ''
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

function isExpectedVmLookupMiss(statusCode: number) {
    return statusCode === 401 || statusCode === 403 || statusCode === 404
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
