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
    if (!validThesis(document)) {
        return NextResponse.json({ error: 'Enter a single-line title (up to 500 characters) and a body up to 1,000,000 characters.' }, { status: 400 })
    }
    try {
        await writeThesis(document)
        return NextResponse.json({ saved: true })
    } catch {
        return NextResponse.json({ error: 'The thesis could not be saved. Your draft is still in the editor.' }, { status: 500 })
    }
}
