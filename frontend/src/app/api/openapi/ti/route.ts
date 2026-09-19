import { currentOpenApi } from '@/utils/api/currentOpenApi'
import { NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function GET() {
    try {
        const response = await fetch(`${authApiUrl().replace(/\/$/, '')}/v1/openapi.json`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`OpenAPI upstream returned ${response.status}`)
        return NextResponse.json(currentOpenApi(await response.json()), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, max-age=0' },
        })
    } catch {
        return NextResponse.json(
            { error: { code: 'openapi_unavailable', message: 'The API contract is temporarily unavailable.' } },
            { status: 503, headers: { 'cache-control': 'no-store, max-age=0' } },
        )
    }
}
