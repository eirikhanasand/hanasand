import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'
import checkPwned from '#utils/checkPwned.ts'
import login from '#utils/login.ts'
import { loadSQL } from '#utils/loadSQL.ts'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
}

export default async function postUser(req: FastifyRequest, res: FastifyReply) {
    const { id, name, password, avatar } = req.body as GetUserBodyProps ?? {}
    const user = { id, name }
    const ip = req.ip

    if (!id || !name || !password) {
        return res.status(400).send({ error: 'Missing fields' })
    }

    let numbers = 0
    let specialCharacters = 0
    let lowerCaseCharacters = 0
    let upperCaseCharacters = 0
    for (const char of password) {
        if (!isNaN(Number(char))) {
            numbers++
        }

        if (/[^a-zA-Z0-9]/.test(char)) {
            specialCharacters++
        }

        if (/[a-z]/.test(char)) {
            lowerCaseCharacters++
        }

        if (/[A-Z]/.test(char)) {
            upperCaseCharacters++
        }
    }

    if (password.length < 16 || numbers < 2 || specialCharacters < 2 || lowerCaseCharacters < 2 || upperCaseCharacters < 2) {
        return res.status(400).send({ error: 'The password does not meet the requirements.' })
    }

    const pwned = await checkPwned(password)
    if ('count' in pwned) {
        return res.status(400).send({ error: `This password is weak, and has been pwned ${pwned.count} ${pwned.count === 1 ? 'time' : 'times'}.` })
    }

    try {
        let assignedRoot = false
        const hashedPassword = await bcrypt.hash(password, 10)
        const response = await run(
            `INSERT INTO users (id, name, password, avatar) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO NOTHING`,
            [id, name, hashedPassword, avatar || '']
        )

        if (!response.rowCount) {
            return res.status(400).send({ error: 'The username is taken.' })
        }

        const userQuery = await loadSQL('assignUserRole.sql')
        await run(userQuery, [id])

        const rootResult = await run(`SELECT * FROM root`)
        if (rootResult.rows.length <= 1) {
            const rootQuery = await loadSQL('assignAdministratorRole.sql')
            await run(rootQuery, [id])
            assignedRoot = true
        }

        const token = await login({ id, ip })
        if (!token) {
            const base = { ...user, message: 'User created', error: 'Unable to login. Please try again later.' }
            const data = assignedRoot ? { ...base, assignedRoot } : base
            res.status(206).send(data)
        }

        const base = { ...user, message: 'User created', token }
        const data = assignedRoot ? { ...base, assignedRoot } : base
        return res.status(201).send(data)
    } catch (err) {
        const error = err as unknown as Error & { code: string }
        if (error.code === '23505') {
            return res.status(409).send({ error: 'User ID already exists' })
        }

        return res.status(500).send({ error: error.message })
    }
}
