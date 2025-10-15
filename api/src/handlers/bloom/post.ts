import checkBloom from '#utils/checkBloom.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export default async function postBloom(req: FastifyRequest, res: FastifyReply) {
    const { password } = req.body as { password: string } ?? {}

    try {
        const bloom = await checkBloom(password)
        if (bloom) {
            return res.status(200).send({ result: {
                message: `This password is weak, and exists in the public breach file '${bloom.file}'.`,
                file: bloom.file
            } })
        }

        return res.status(200).send({ result: 'No hits' })
    } catch (error) {
        return res.status(400).send({ error: 'Unknown error'})
    }
}
