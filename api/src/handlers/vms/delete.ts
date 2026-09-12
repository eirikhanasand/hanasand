import type { FastifyReply, FastifyRequest } from 'fastify'
import { vmViewer } from '#utils/vms/access.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { restoreVm, scheduleVmDeletion } from '#utils/vms/deletion.ts'

export default async function deleteVM(req: FastifyRequest, res: FastifyReply) { return changeDeletion(req, res, false) }
export async function restoreVM(req: FastifyRequest, res: FastifyReply) { return changeDeletion(req, res, true) }

async function changeDeletion(req: FastifyRequest, res: FastifyReply, restore: boolean) {
    const viewer = await vmViewer(req, res)
    if (!viewer) return
    if (!viewer.admin) return res.status(403).send({ error: 'Only an administrator can delete or restore VMs.' })
    const { id } = req.params as { id: string }
    if (!id) return res.status(400).send({ error: 'Missing VM name.' })
    try {
        const vm = restore ? await restoreVm(id) : await scheduleVmDeletion(id, (req.body as { confirmation?: string } | undefined)?.confirmation)
        await recordSystemEvent(req, { actionType: restore ? 'vm.restored' : 'vm.deletion_scheduled', actorId: viewer.id, targetType: 'vm', targetId: id, context: { deleteAfter: vm.delete_after } })
        return res.send({ message: restore ? 'VM restored.' : 'VM stopped. You can restore it for 30 days.', vm })
    } catch (error) {
        req.log.error({ err: error, id }, 'Unable to change VM deletion state.')
        const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 503
        return res.status(status).send({ error: error instanceof Error ? error.message : 'Unable to update the VM. Try again.' })
    }
}
