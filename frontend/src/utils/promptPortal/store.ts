import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const IDLE_MS = 15 * 60 * 1000
const MAX_ITEMS = 80
const MAX_FILE_BYTES = 2 * 1024 * 1024

export type PromptPortalFile = {
    id: string
    name: string
    type: string
    size: number
    path: string
}

export type PromptPortalItem = {
    id: string
    prompt: string
    priority: 'now' | 'next'
    status: 'queued' | 'running' | 'done' | 'error'
    createdAt: string
    startedAt?: string
    completedAt?: string
    result?: string
    files: PromptPortalFile[]
}

type PromptPortalSession = {
    id: string
    createdAt: string
    codeHash: string
}

export type PromptPortalState = {
    usedCodeHashes: string[]
    sessions: Record<string, PromptPortalSession>
    items: PromptPortalItem[]
    activeSince?: string
    lastCompletedAt?: string
}

export type PromptPortalPublicState = {
    authenticated: boolean
    readOnly: boolean
    items: PromptPortalItem[]
    idleExpiresAt?: string
}

const emptyState: PromptPortalState = {
    usedCodeHashes: [],
    sessions: {},
    items: [],
}

export function promptPortalCodeHash(code: string) {
    return createHash('sha256').update(code).digest('hex')
}

export function configuredPromptCodeHashes(env: Record<string, string | undefined> = process.env) {
    return (env.PROMPT_PORTAL_CODE_HASHES || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
}

export function verifyWorkerToken(value: string | null, env: Record<string, string | undefined> = process.env) {
    const expected = env.PROMPT_PORTAL_WORKER_TOKEN?.trim()
    if (!expected || !value) return false
    const left = Buffer.from(value)
    const right = Buffer.from(expected)
    return left.length === right.length && timingSafeEqual(left, right)
}

export function promptPortalReadOnly(state: PromptPortalState, now = Date.now()) {
    const openItem = state.items.some(item => item.status === 'queued' || item.status === 'running')
    if (openItem) return false
    const baseline = Date.parse(state.lastCompletedAt || state.activeSince || '')
    return Number.isFinite(baseline) && now - baseline > IDLE_MS
}

export function promptPortalIdleExpiresAt(state: PromptPortalState) {
    if (state.items.some(item => item.status === 'queued' || item.status === 'running')) return undefined
    const baseline = Date.parse(state.lastCompletedAt || state.activeSince || '')
    return Number.isFinite(baseline) ? new Date(baseline + IDLE_MS).toISOString() : undefined
}

export function publicPromptPortalState(state: PromptPortalState, sessionId?: string): PromptPortalPublicState {
    const authenticated = Boolean(sessionId && state.sessions[sessionId])
    return {
        authenticated,
        readOnly: authenticated && promptPortalReadOnly(state),
        items: authenticated ? [...state.items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : [],
        idleExpiresAt: authenticated ? promptPortalIdleExpiresAt(state) : undefined,
    }
}

export async function readPromptPortalState() {
    try {
        return { ...emptyState, ...JSON.parse(await readFile(statePath(), 'utf8')) } as PromptPortalState
    } catch {
        return { ...emptyState, sessions: {}, items: [], usedCodeHashes: [] }
    }
}

export async function writePromptPortalState(state: PromptPortalState) {
    await mkdir(promptPortalDir(), { recursive: true })
    const file = statePath()
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    const next: PromptPortalState = {
        ...state,
        items: state.items.slice(-MAX_ITEMS),
    }
    // ponytail: single-user portal; replace this with a lock if multiple writers start racing.
    await writeFile(tmp, JSON.stringify(next, null, 2))
    await rename(tmp, file)
}

export async function createPromptPortalSession(state: PromptPortalState, code: string) {
    const codeHash = promptPortalCodeHash(code)
    const allowed = configuredPromptCodeHashes()
    if (!allowed.includes(codeHash) || state.usedCodeHashes.includes(codeHash)) return null

    const id = randomBytes(24).toString('hex')
    const now = new Date().toISOString()
    state.usedCodeHashes.push(codeHash)
    state.sessions[id] = { id, codeHash, createdAt: now }
    state.activeSince = now
    state.lastCompletedAt = undefined
    return id
}

export async function savePromptPortalFile(file: File): Promise<PromptPortalFile> {
    if (!file.type.startsWith('image/')) throw new Error('Only image uploads are accepted.')
    if (file.size > MAX_FILE_BYTES) throw new Error('Images must be 2 MB or smaller.')
    const id = randomBytes(12).toString('hex')
    const extension = path.extname(file.name).replace(/[^.\w-]/g, '').slice(0, 12)
    const name = `${id}${extension || '.img'}`
    const relativePath = `files/${name}`
    const absolutePath = path.join(promptPortalDir(), relativePath)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()))
    return {
        id,
        name: file.name.slice(0, 120) || name,
        type: file.type,
        size: file.size,
        path: relativePath,
    }
}

export async function readPromptPortalFile(filePath: string) {
    const root = path.resolve(promptPortalDir())
    const absolutePath = path.resolve(root, filePath)
    if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new Error('Invalid file path.')
    return readFile(absolutePath)
}

export function promptPortalWorkerToken(env: Record<string, string | undefined> = process.env) {
    return env.PROMPT_PORTAL_WORKER_TOKEN?.trim() || ''
}

function promptPortalDir(env: Record<string, string | undefined> = process.env) {
    return env.PROMPT_PORTAL_STATE_DIR || '/var/lib/hanasand-prompt'
}

function statePath() {
    return path.join(promptPortalDir(), 'state.json')
}
