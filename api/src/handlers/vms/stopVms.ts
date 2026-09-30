import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { recordServiceCheckCase } from '#utils/status/serviceCheckCase.ts'

export default async function stopVms(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasHanasandInternalRouteAccess(req)
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const startedAt = performance.now()
    const checkTime = new Date().toISOString()
    let monitorStopAll = false
    try {
        const { id } = req.params as { id?: string }
        const { vms } = req.body as { vms?: string[] } ?? {}

        const names = Array.isArray(vms) && vms.length
            ? vms
            : id
                ? [id]
                : []

        monitorStopAll = names.length === 0
        let targetNames = names

        if (!targetNames.length) {
            const result = await run(`
                SELECT v.name
                FROM vms v
                LEFT JOIN vm_details d ON d.name = v.name
                WHERE LOWER(COALESCE(d.status, 'stopped')) <> 'stopped'
                ORDER BY v.name ASC
            `)

            targetNames = result.rows.map((row) => String(row.name))
        }

        if (!targetNames.length) {
            if (monitorStopAll) await recordStopAllVmsCase(checkTime, performance.now() - startedAt, 'Stop all VMs was requested, but no running VMs were found.')
            return res.send({
                success: true,
                message: 'No running VMs to stop.',
                vms: [],
            })
        }

        const result = await run(`
            INSERT INTO vm_shutdown (name, "time")
            SELECT unnest($1::text[]) AS name, NOW() + INTERVAL '20 minutes'
            ON CONFLICT (name) DO UPDATE
            SET "time" = EXCLUDED."time"
            RETURNING name
        `, [targetNames])

        const queuedNames = result.rows.map((row) => String(row.name))
        if (monitorStopAll) await recordStopAllVmsCase(checkTime, performance.now() - startedAt, `Emergency VM shutdown requested; queued shutdown for ${queuedNames.length} VM${queuedNames.length === 1 ? '' : 's'}: ${queuedNames.join(', ')}.`)

        await recordSystemEvent(req, {
            actionType: 'vm.shutdown.queued',
            actorId: userId || null,
            targetType: 'vm_batch',
            targetId: queuedNames.join(','),
            context: { vmNames: queuedNames },
        })

        return res.send({
            success: true,
            message: `Queued shutdown for ${result.rows.length} VM${result.rows.length === 1 ? '' : 's'}.`,
            vms: queuedNames,
        })
    } catch (error) {
        if (monitorStopAll) try { await recordStopAllVmsCase(checkTime, performance.now() - startedAt, `Emergency VM shutdown request failed: ${error instanceof Error ? error.message : 'unknown error'}.`) }
        catch (monitorError) { console.error('VM shutdown health check could not be recorded:', monitorError) }
        console.error(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}


async function recordStopAllVmsCase(checkedAt: string, latencyMs: number, message: string) {
    try {
        await recordServiceCheckCase('virtual-machines', 'Emergency stop all VMs', {
            status: 'down', checkedAt, latencyMs: Math.max(0, Math.round(latencyMs)), message,
        })
    } catch (error) {
        // Monitoring delivery must not turn a queued VM shutdown into an API failure.
        console.error('VM shutdown health check could not be recorded:', error)
    }
}
