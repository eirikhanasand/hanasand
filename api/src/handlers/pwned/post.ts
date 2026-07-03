import checkPwned from '#utils/pwned/checkPwned.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function postPwned(req: FastifyRequest, res: FastifyReply) {
    const { password } = req.body as { password: string } ?? {}
    if (typeof password !== 'string' || !password.length) {
        return res.status(400).send({ error: 'Password is required.' })
    }

    try {
        const pwned = await checkPwned(password)
        return res.status(200).send({
            ...pwned,
            message: pwned.ok
                ? 'No exact match was found in the indexed breach data.'
                : `This password has previously been found in a data breach ${pwned.count} ${pwned.count > 1 ? 'times' : 'time'}. This implies that threat actors may use this password more commonly to breach accounts. Please select a new password. Using a password manager to generate random passwords is recommended.`
        })
    } catch (error) {
        req.log.warn({ error }, 'Unable to check pwned password dataset')
        return res.status(503).send({ error: 'Unable to check the password exposure dataset right now.' })
    }
}
