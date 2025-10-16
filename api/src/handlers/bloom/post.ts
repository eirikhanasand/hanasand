import checkBloom from '#utils/checkBloom.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function postBloom(req: FastifyRequest, res: FastifyReply) {
    const { password } = req.body as { password: string } ?? {}

    try {
        const bloom = await checkBloom(password)
        if (bloom) {
            return res.status(200).send({ 
                ...bloom, 
                message: `This password has previously been found in a data breach ${bloom.count} ${bloom.count > 1 ? 'times' : 'time'}. This implies that threat actors may use this password more commonly to breach accounts. Please select a new password. Using a password manager to generate random passwords is recommended.` 
            })
        }

        return res.status(200).send({ result: 'No hits' })
    } catch (error) {
        return res.status(400).send({ error: 'Unknown error' })
    }
}
