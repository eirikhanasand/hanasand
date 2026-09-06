import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { canEditThesis } from '@/utils/thesis'
import type { CodeInventory, ReviewEvent } from '@/utils/codeReviewTypes'
import config from '@/config'

export const dynamic = 'force-dynamic'
let source: Promise<CodeInventory> | undefined
function inventory() {
    source ??= readFile(path.join(process.cwd(), 'code-inventory.json'), 'utf8').then(value => JSON.parse(value) as CodeInventory).catch(error => { source = undefined; throw error })
    return source
}
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
async function authorized(request: NextRequest) {
    return canEditThesis(request.cookies.get('access_token')?.value, request.cookies.get('id')?.value)
}
async function reviews(request: NextRequest, suffix = '', body?: unknown) {
    const response = await fetch(`${config.url.api}/thesis/code-reviews${suffix}`, {
        method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${request.cookies.get('access_token')!.value}`, id: request.cookies.get('id')!.value, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Review storage is unavailable. Please retry.')
    return response.json()
}
export async function GET(request: NextRequest) {
    try {
        if (!await authorized(request)) return json({ error: 'Source code is only available to the owner.' }, 403)
        const data = await inventory(), id = request.nextUrl.searchParams.get('id')
        if (id) {
            const item = data.nodes.find(node => node.id === id)
            if (!item) return json({ error: 'This item is not in the current release. Refresh the inventory.' }, 404)
            const before = request.nextUrl.searchParams.get('before')
            const history = await reviews(request, '?' + new URLSearchParams({ id, ...(before ? { before } : {}) }))
            return json({ item, history })
        }
        const events = await reviews(request) as ReviewEvent[]
        const byId = new Map(events.map(event => [event.item_id, event]))
        return json({ ...data, release: process.env.HANASAND_RELEASE_COMMIT || 'development', nodes: data.nodes.map(item => ({ ...item, content: undefined, review: byId.get(item.id) })) })
    } catch { return json({ error: 'The code inventory or review history could not be loaded. Please retry.' }, 503) }
}
export async function POST(request: NextRequest) {
    try {
        const origin = request.headers.get('origin')
        if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get('host') || !await authorized(request)) return json({ error: 'Only the owner can review source code.' }, 403)
        const input = await request.json().catch(() => null)
        const data = await inventory(), item = data.nodes.find(node => node.id === input?.id)
        if (!item || typeof input.approved !== 'boolean' || typeof input.eventId !== 'string') return json({ error: 'Invalid review.' }, 400)
        if (input.reviewHash !== item.reviewHash || input.sha256 !== item.sha256) return json({ error: 'This item changed. Refresh and review the current version before approving.' }, 409)
        return json(await reviews(request, '', { id: item.id, sha256: item.sha256, reviewHash: item.reviewHash, approved: input.approved, eventId: input.eventId }))
    } catch { return json({ error: 'The review could not be saved. Please retry.' }, 503) }
}
