import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { canEditThesis } from '@/utils/thesis'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import type { CodeInventory, ReviewEvent } from '@/utils/codeReviewTypes'
import config from '@/config'

export const dynamic = 'force-dynamic'
let source: Promise<CodeInventory> | undefined
let signature = ''
async function inventory() {
    const file = process.env.CODE_REVIEW_INVENTORY_PATH || path.join(process.cwd(), 'code-inventory.json')
    const info = await stat(file), next = `${info.mtimeMs}:${info.size}`
    if (!source || signature !== next) {
        signature = next
        source = readFile(file, 'utf8').then(value => JSON.parse(value) as CodeInventory).catch(error => { source = undefined; throw error })
    }
    const data = await source
    if (!process.env.CODE_REVIEW_INVENTORY_PATH) return data
    const sync = JSON.parse(await readFile(path.join(path.dirname(file), 'status.json'), 'utf8')) as NonNullable<CodeInventory['sync']>
    if (!sync.checkedAt || Date.now() - Date.parse(sync.checkedAt) > 120000) sync.error = 'Git synchronization has stopped. The last indexed version is shown.'
    return { ...data, sync }
}
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
async function memberSession(request: NextRequest) {
    const session = await requireApiSession(request)
    if ('response' in session) return { response: session.response }
    try {
        if (!await isHanasandOrganizationMember(session.identity.token, session.identity.id)) return { response: json({ error: 'Membership in the Hanasand organization is required to view source code.' }, 403) }
        return { session: session.identity }
    } catch { return { response: json({ error: 'Organization membership could not be checked. Please retry.' }, 503) }
    }
}
async function reviews(identity: { id: string, token: string }, suffix = '', body?: unknown, internal = false) {
    if (internal && !process.env.VM_API_TOKEN) throw new Error('Review access is not configured.')
    const token = internal ? process.env.VM_API_TOKEN! : identity.token
    const response = await fetch(`${config.url.api}/thesis/code-reviews${suffix}`, {
        method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, id: internal ? '' : identity.id, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Review storage is unavailable. Please retry.')
    return response.json()
}
export async function GET(request: NextRequest) {
    const access = await memberSession(request)
    if ('response' in access) return access.response
    try {
        const internal = !await canEditThesis(access.session.token, access.session.id)
        const data = await inventory(), id = request.nextUrl.searchParams.get('id')
        if (id) {
            const item = data.nodes.find(node => node.id === id)
            if (!item) return json({ error: 'This item is not in the current release. Refresh the inventory.' }, 404)
            const before = request.nextUrl.searchParams.get('before')
            const history = await reviews(access.session, '?' + new URLSearchParams({ id, ...(before ? { before } : {}) }), undefined, internal)
            return json({ item, history })
        }
        if (request.nextUrl.searchParams.get('since') === data.hash + ':' + (data.revision || '') && (!data.sync || data.sync.phase === 'ready') && !data.sync?.error && !data.sync?.warning) return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
        const events = await reviews(access.session, '', undefined, internal) as ReviewEvent[]
        const byId = new Map(events.map(event => [event.item_id, event]))
        return json({ ...data, release: data.revision || process.env.HANASAND_RELEASE_COMMIT || 'development', nodes: data.nodes.map(item => ({ ...item, content: undefined, review: byId.get(item.id) })) })
    } catch { return json({ error: 'The code inventory or review history could not be loaded. Please retry.' }, 503) }
}
export async function POST(request: NextRequest) {
    const access = await memberSession(request)
    if ('response' in access) return access.response
    try {
        const origin = request.headers.get('origin')
        if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get('host') || !await canEditThesis(access.session.token, access.session.id)) return json({ error: 'Only the owner can review source code.' }, 403)
        const input = await request.json().catch(() => null)
        const data = await inventory()
        if (data.sync && (data.sync.phase !== 'ready' || data.sync.error)) return json({ error: 'Git is being synchronized. Wait for the current version before approving.' }, 409)
        const item = data.nodes.find(node => node.id === input?.id)
        if (!item || typeof input.approved !== 'boolean' || typeof input.eventId !== 'string') return json({ error: 'Invalid review.' }, 400)
        if (input.reviewHash !== item.reviewHash || input.sha256 !== item.sha256) return json({ error: 'This item changed. Refresh and review the current version before approving.' }, 409)
        return json(await reviews(access.session, '', { id: item.id, sha256: item.sha256, reviewHash: item.reviewHash, approved: input.approved, eventId: input.eventId }))
    } catch { return json({ error: 'The review could not be saved. Please retry.' }, 503) }
}
