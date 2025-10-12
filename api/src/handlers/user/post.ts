import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
}

export default async function postUser(req: FastifyRequest, res: FastifyReply) {
    const { id, name, password, avatar } = req.body as GetUserBodyProps

    if (!id || !name || !password || !avatar) {
        return res.status(400).send({ error: "Missing fields" })
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10)
        await run("INSERT INTO users (id, name, password, avatar) VALUES ($1, $2, $3, $4)", [id, name, hashedPassword, avatar])
        return res.status(201).send({ message: "User created" })
    } catch (err) {
        const error = err as unknown as Error & { code: string }
        if (error.code === '23505') {
            return res.status(409).send({ error: "User ID already exists" })
        }
        return res.status(500).send({ error: error.message })
    }
}
