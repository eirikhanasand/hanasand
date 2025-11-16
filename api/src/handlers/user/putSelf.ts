import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import run from '#db'
import checkPwned from '#utils/pwned/checkPwned.ts'
import login from '#utils/auth/login.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
}

export default async function putSelf(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { name, password, avatar } = req.body as GetUserBodyProps ?? {}
    const ip = req.ip
    const id = req.headers['id']
    if (!id || Array.isArray(id)) {
        return res.status(400).send({ error: 'No user provided.' })
    }

    if (password) {
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
            const hashedPassword = await bcrypt.hash(password, 10)
            const response = await run(
                `UPDATE users
                SET password = $2
                WHERE id = $1
                RETURNING id`,
                [id, hashedPassword]
            )

            if (!response.rowCount) {
                return res.status(400).send({ error: 'User not found.' })
            }

            const token = await login({ id, ip })
            if (!token) {
                res.status(206).send({
                    message: 'Password updated, and you were logged out. Logging you back in was not possible due to an unknown error.',
                    error: 'Unable to login. Please try again later.'
                })
            }

            return res.status(201).send({ message: 'Password updated', token })
        } catch (error) {
            console.error(`Database error: ${JSON.stringify(error)}`)
            return res.status(500).send({ error: 'Internal Server Error' })
        }
    }

    try {
        const fieldsToUpdate: string[] = []
        const values: any[] = []
        let idx = 1

        if (name !== undefined) {
            fieldsToUpdate.push(`name = $${idx}`)
            values.push(name)
            idx++
        }

        if (avatar !== undefined) {
            fieldsToUpdate.push(`avatar = $${idx}`)
            values.push(avatar)
            idx++
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).send({ error: 'No fields provided to update.' })
        }

        values.push(id)
        const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${idx} RETURNING *`

        const response = await run(query, values)
        if (!response.rowCount) {
            return res.status(404).send({ error: 'User not found.' })
        }

        const updatedUser = response.rows[0]
        const token = await login({ id: updatedUser.id, ip })

        return res.status(200).send({ ...updatedUser, message: 'User updated', token })
    } catch (err) {
        const error = err as unknown as Error & { code?: string }
        if (error.code === '23505') {
            return res.status(409).send({ error: 'Duplicate value conflict' })
        }

        return res.status(500).send({ error: error.message })
    }
}
