import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'

type LoginBody = {
    id: string
    password: string
}

export default async function loginHandler(req: FastifyRequest, res: FastifyReply) {
    const { id, password } = req.body as LoginBody

    if (!id || !password) {
        return res.status(400).send({ error: "Missing fields" })
    }

    try {
        const ip = req.ip
        console.log(ip)
        const query = 'SELECT id, name, password, avatar FROM users WHERE id = $1'
        const result = await run(query, [id])

        if (result.rows.length === 0) {
            return res.status(404).send({ error: "User not found" })
        }

        const attemptCheck = await run('SELECT attempts FROM attempts WHERE id = $1', [id]);
        if (attemptCheck.rows.length > 0 && attemptCheck.rows[0].attempts >= 3) {
            console.log("Too many failed attempts. Please try again later.")
            return res.status(429).send({ error: "Please try again later." })
        }

        const user = result.rows[0]
        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
            const attemptQuery = `
            INSERT INTO attempts (id, attempts, ip)
            VALUES ($1, 1, $2)
            ON CONFLICT (id)
            DO UPDATE SET
                attempts = attempts + 1,
                ip = EXCLUDED.ip,
                timestamp = NOW();
            `
            await run(attemptQuery, [id, ip])
            console.log(`Invalid password for ${id}.`)
            return res.status(401).send({ error: "Please try again later." })
        }

        await run('DELETE FROM attempts WHERE id = $1 AND ip = $2', [id, ip])

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user
        return res.send(userWithoutPassword)
    } catch (err: unknown) {
        const error = err as Error
        return res.status(500).send({ error: error.message })
    }
}
