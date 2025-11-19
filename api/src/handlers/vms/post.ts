import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'
import { loadSQL } from '#utils/loadSQL.ts'

export default async function postVM(req: FastifyRequest, res: FastifyReply) {
    const tokenHeader = req.headers['authorization'] || ''
    const token = tokenHeader.split(' ')[1] ?? ''
    const { name, owner, created_by, access_users } = req.body as {
        name: string
        owner: string
        created_by: string
        access_users?: string[]
    } ?? {}

    if (!token || Array.isArray(token) || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    if (!name || !owner || !created_by) {
        return res.status(400).send({ error: "Missing required fields" })
    }

    try {
        const query = await loadSQL('insertVM.sql')
        const result = await run(query, [name, owner, created_by, JSON.stringify(access_users ?? [])])
        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
