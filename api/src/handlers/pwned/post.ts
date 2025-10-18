import checkPwned from '#utils/checkPwned.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function postPwned(req: FastifyRequest, res: FastifyReply) {
    const { password } = req.body as { password: string } ?? {}

    try {
        const pwned = await checkPwned(password)
        if ('count' in pwned) {
            return res.status(200).send({ 
                ...pwned, 
                message: `This password has previously been found in a data breach ${pwned.count} ${pwned.count > 1 ? 'times' : 'time'}. This implies that threat actors may use this password more commonly to breach accounts. Please select a new password. Using a password manager to generate random passwords is recommended.` 
            })
        }

        return res.status(200).send({ result: 'No hits' })
    } catch (error) {
        return res.status(400).send({ error: 'Unknown error' })
    }
}
