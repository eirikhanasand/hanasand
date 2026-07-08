import { NextRequest, NextResponse } from 'next/server'
import {
    promptPortalReadOnly,
    promptPortalWorkerToken,
    readPromptPortalState,
    verifyWorkerToken,
    writePromptPortalState,
} from '@/utils/promptPortal/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const state = await readPromptPortalState()
    const readOnly = promptPortalReadOnly(state)
    const item = readOnly ? undefined : state.items
        .filter(candidate => candidate.status === 'queued')
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]

    if (!item) return NextResponse.json({ ok: true, readOnly, item: null })

    item.status = 'running'
    item.startedAt = new Date().toISOString()
    await writePromptPortalState(state)

    const token = promptPortalWorkerToken()
    const files = item.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: new URL(`/api/prompt/file?itemId=${encodeURIComponent(item.id)}&fileId=${encodeURIComponent(file.id)}&token=${encodeURIComponent(token)}`, request.url).toString(),
    }))

    return NextResponse.json({
        ok: true,
        readOnly,
        item: { ...item, files },
        instructions: 'Post the result to this endpoint with {action:"complete",id,status,result}. Do not answer in Codex chat.',
    })
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (body?.action !== 'complete') {
        return NextResponse.json({ ok: false, error: 'Unsupported worker action.' }, { status: 400 })
    }

    const state = await readPromptPortalState()
    const item = state.items.find(candidate => candidate.id === body.id)
    if (!item) return NextResponse.json({ ok: false, error: 'Prompt item not found.' }, { status: 404 })

    item.status = body.status === 'error' ? 'error' : 'done'
    item.completedAt = new Date().toISOString()
    item.result = String(body.result || '').slice(0, 20000)
    state.lastCompletedAt = item.completedAt
    await writePromptPortalState(state)
    return NextResponse.json({ ok: true, readOnly: promptPortalReadOnly(state), item })
}

function authorized(request: NextRequest) {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
    return verifyWorkerToken(bearer || request.nextUrl.searchParams.get('token'))
}

function priorityRank(value: string) {
    return value === 'now' ? 0 : 1
}
