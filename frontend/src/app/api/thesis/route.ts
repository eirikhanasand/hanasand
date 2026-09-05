import { NextRequest, NextResponse } from 'next/server'
import { canEditThesis, readThesis, validThesis, writeThesis } from '@/utils/thesis'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        return NextResponse.json(await readThesis(), { headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return NextResponse.json({ error: 'The thesis could not be loaded.' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }
    if (!await canEditThesis(request.cookies.get('access_token')?.value, request.cookies.get('id')?.value)) {
        return NextResponse.json({ error: 'Only eirikhanasand can edit the thesis.' }, { status: 403 })
    }
    const document = await request.json().catch(() => null)
    if (!validThesis(document)) return NextResponse.json({ error: 'Enter a non-empty title of at most 500 characters.' }, { status: 400 })
    try {
        const response = await writeThesis(document, request.cookies.get('access_token')!.value, request.cookies.get('id')!.value)
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch {
        return NextResponse.json({ error: 'The thesis could not be saved. Your draft is kept in this browser.' }, { status: 500 })
    }
}

// sendBeacon uses POST when the page is being hidden or closed.
export const POST = PUT
