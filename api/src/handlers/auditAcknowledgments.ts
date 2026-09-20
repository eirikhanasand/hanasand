import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { requireAdminSupport } from './adminSupport.ts'

type Request = FastifyRequest<{ Params: { id: string } }>

export async function setAuditAcknowledgment(req: Request, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).send({ error: 'Invalid event ID.' })
    if (req.method === 'DELETE') {
        const event = await run('SELECT id FROM system_events WHERE id = $1', [id])
        if (!event.rows.length) return res.status(404).send({ error: 'Event not found.' })
        await run('DELETE FROM system_event_acknowledgments WHERE event_id = $1', [id])
        return res.send({ acknowledged_at: null, acknowledged_by: null })
    }
    const result = await run(`
        INSERT INTO system_event_acknowledgments (event_id, acknowledged_by)
        SELECT id, $2 FROM system_events WHERE id = $1
        ON CONFLICT (event_id) DO UPDATE SET event_id = EXCLUDED.event_id
        RETURNING acknowledged_at, acknowledged_by
    `, [id, actor.id])
    if (!result.rows.length) return res.status(404).send({ error: 'Event not found.' })
    return res.send(result.rows[0])
}
