import { NextRequest, NextResponse } from 'next/server'
import type { PromptPortalItem } from '@/utils/promptPortal/store'
import {
    promptPortalReadOnly,
    promptPortalWorkerToken,
    readPromptPortalState,
    verifyWorkerToken,
    writePromptPortalState,
} from '@/utils/promptPortal/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BATCH_ITEMS = 8

export async function GET(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const state = await readPromptPortalState()
    const readOnly = promptPortalReadOnly(state)
    const batch = readOnly ? [] : state.items
        .filter(candidate => candidate.status === 'queued')
        .sort(comparePromptItems)
        .slice(0, MAX_BATCH_ITEMS)

    if (!batch.length) return NextResponse.json({ ok: true, readOnly, item: null })

    const startedAt = new Date().toISOString()
    batch.forEach(item => {
        item.status = 'running'
        item.startedAt = startedAt
    })
    await writePromptPortalState(state)

    const token = promptPortalWorkerToken()
    const files = batch.flatMap(item => item.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: new URL(`/api/prompt/file?itemId=${encodeURIComponent(item.id)}&fileId=${encodeURIComponent(file.id)}&token=${encodeURIComponent(token)}`, request.url).toString(),
    })))
    const item = batch.length === 1 ? batch[0] : batchItem(batch)

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
    const ids = String(body.id || '').split(',').filter(Boolean)
    const items = state.items.filter(candidate => ids.includes(candidate.id))
    if (!items.length) return NextResponse.json({ ok: false, error: 'Prompt item not found.' }, { status: 404 })

    const completedAt = new Date().toISOString()
    items.forEach(item => {
        item.status = body.status === 'error' ? 'error' : 'done'
        item.completedAt = completedAt
        item.result = String(body.result || '').slice(0, 20000)
    })
    state.lastCompletedAt = completedAt
    await writePromptPortalState(state)
    return NextResponse.json({ ok: true, readOnly: promptPortalReadOnly(state), item: items.length === 1 ? items[0] : batchItem(items) })
}

function authorized(request: NextRequest) {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
    return verifyWorkerToken(bearer || request.nextUrl.searchParams.get('token'))
}

function batchItem(items: PromptPortalItem[]): PromptPortalItem {
    return {
        ...items[0],
        id: items.map(item => item.id).join(','),
        prompt: [
            'Execute these queued instructions in priority order. Later high-priority items have already been moved up.',
            ...items.map((item, index) => `${index + 1}. ${item.prompt}`),
        ].join('\n\n'),
        files: items.flatMap(item => item.files),
    }
}

function comparePromptItems(a: PromptPortalItem, b: PromptPortalItem) {
    return priorityRank(a.priority) - priorityRank(b.priority) || Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

function priorityRank(value: PromptPortalItem['priority']) {
    return value === 'now' ? 0 : 1
}
