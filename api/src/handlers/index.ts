import { FastifyReply, FastifyRequest } from 'fastify'

/**
 * API index/root (`/`) handler. Prints the available routes. 
 * 
 * @param req Incoming Fastify Request
 * @param res Outgoing Fastify Response
 * 
 * @returns Fastify Response
 */
export default async function IndexHandler(req: FastifyRequest, res: FastifyReply) {
    const routes = req.server.printRoutes({ commonPrefix: false })
    return res.send(`Welcome to the Library Safety Manager!\n\nValid routes are:\n${routes}`)
}
