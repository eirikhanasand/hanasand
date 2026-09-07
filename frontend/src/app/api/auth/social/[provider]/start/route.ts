import { NextRequest } from 'next/server'
import { start } from '../../proxy'

export async function GET(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
    return start(req, (await context.params).provider)
}
export const POST = GET
