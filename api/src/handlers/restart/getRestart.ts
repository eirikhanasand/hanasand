import sanitize from '#utils/sanitize.ts'
import { exec } from 'child_process'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function restartHandler(req: FastifyRequest, res: FastifyReply) {
    const { id: Id } = req.params as { id: string }
    const id = sanitize(Id)

    if (!id) {
        return res.status(400).send({ error: 'No service provided' })
    }
    

    exec(`cd ${id}; git pull; docker compose up --build`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error redeploying service: ${error.message}`)
            return res.status(500).send({ error: error.message })
        }

        console.log(stdout || stderr)
        return res.send({ ok: true })
    })
}
