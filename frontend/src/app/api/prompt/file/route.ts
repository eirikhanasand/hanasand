import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { readPromptPortalFile, readPromptPortalState, verifyWorkerToken } from '@/utils/promptPortal/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COOKIE = 'hanasand_prompt_session'

export async function GET(request: NextRequest) {
    const state = await readPromptPortalState()
    const session = (await cookies()).get(COOKIE)?.value
    const worker = verifyWorkerToken(request.nextUrl.searchParams.get('token'))
    if (!worker && (!session || !state.sessions[session])) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const item = state.items.find(candidate => candidate.id === request.nextUrl.searchParams.get('itemId'))
    const file = item?.files.find(candidate => candidate.id === request.nextUrl.searchParams.get('fileId'))
    if (!file) return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 })

    const data = await readPromptPortalFile(file.path)
    return new NextResponse(data, {
        headers: {
            'content-type': file.type,
            'cache-control': 'no-store',
            'content-length': String(file.size),
        },
    })
}
