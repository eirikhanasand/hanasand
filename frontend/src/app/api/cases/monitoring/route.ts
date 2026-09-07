import { NextRequest } from 'next/server'
import { GET as proxyBackend } from '../../backend/[...path]/route'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
    return proxyBackend(request, { params: Promise.resolve({ path: ['cases', 'monitoring'] }) })
}
