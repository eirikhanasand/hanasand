import { NextRequest } from 'next/server'
import { callback } from '../../proxy'

export async function GET(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
    return callback(req, (await context.params).provider)
}
export const POST = GET
