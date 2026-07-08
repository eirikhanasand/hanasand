import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
    createPromptPortalSession,
    promptPortalReadOnly,
    publicPromptPortalState,
    readPromptPortalState,
    savePromptPortalFile,
    writePromptPortalState,
} from '@/utils/promptPortal/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COOKIE = 'hanasand_prompt_session'
const MAX_PROMPT_LENGTH = 6000
const MAX_FILES = 3

export async function GET() {
    const state = await readPromptPortalState()
    return NextResponse.json(publicPromptPortalState(state, await sessionId()))
}

export async function POST(request: NextRequest) {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) return enqueuePrompt(request)

    const body = await request.json().catch(() => null)
    if (body?.action !== 'login') {
        return NextResponse.json({ ok: false, error: 'Unsupported prompt portal action.' }, { status: 400 })
    }

    const code = String(body.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
        return NextResponse.json({ ok: false, error: 'Enter the 6 digit code.' }, { status: 400 })
    }

    const state = await readPromptPortalState()
    const id = await createPromptPortalSession(state, code)
    if (!id) {
        return NextResponse.json({ ok: false, error: 'Code is invalid or already used.' }, { status: 401 })
    }

    await writePromptPortalState(state)
    const response = NextResponse.json({ ok: true, ...publicPromptPortalState(state, id) })
    response.cookies.set(COOKIE, id, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 24 * 60 * 60,
    })
    return response
}

async function enqueuePrompt(request: NextRequest) {
    const state = await readPromptPortalState()
    const id = await sessionId()
    if (!id || !state.sessions[id]) {
        return NextResponse.json({ ok: false, error: 'Login required.' }, { status: 401 })
    }
    if (promptPortalReadOnly(state)) {
        return NextResponse.json({ ok: false, error: 'Portal is read only. Request a new code.' }, { status: 423 })
    }

    const form = await request.formData()
    const prompt = String(form.get('prompt') || '').trim().slice(0, MAX_PROMPT_LENGTH)
    if (!prompt) {
        return NextResponse.json({ ok: false, error: 'Prompt is required.' }, { status: 400 })
    }

    const files: Awaited<ReturnType<typeof savePromptPortalFile>>[] = []
    for (const value of form.getAll('files').slice(0, MAX_FILES)) {
        if (value instanceof File && value.size > 0) files.push(await savePromptPortalFile(value))
    }

    state.items.push({
        id: randomBytes(10).toString('hex'),
        prompt,
        files,
        priority: form.get('priority') === 'now' ? 'now' : 'next',
        status: 'queued',
        createdAt: new Date().toISOString(),
    })
    await writePromptPortalState(state)
    return NextResponse.json({ ok: true, ...publicPromptPortalState(state, id) })
}

async function sessionId() {
    return (await cookies()).get(COOKIE)?.value
}
