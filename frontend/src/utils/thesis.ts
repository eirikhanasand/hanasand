import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import tokenIsValid from '@/utils/proxy/tokenIsValid'

export type ThesisDocument = { title: string, body: string }

export async function canEditThesis(token?: string, id?: string) {
    if (!token || !id) return false
    const auth = await tokenIsValid(token, id)
    return auth.state === 'valid' && auth.name === 'eirikhanasand'
}

export function validThesis(value: unknown): value is ThesisDocument {
    if (!value || typeof value !== 'object') return false
    const document = value as ThesisDocument
    return typeof document.title === 'string' && document.title.trim().length > 0
        && document.title.length <= 500 && !/[\r\n]/.test(document.title)
        && typeof document.body === 'string' && document.body.length <= 1_000_000
}

function thesisPath() {
    // Reuse the frontend's persistent volume so redeploys preserve the shared document.
    return path.join(process.env.PROMPT_PORTAL_STATE_DIR || '/var/lib/hanasand-prompt', 'thesis.json')
}

export async function readThesis(): Promise<ThesisDocument> {
    try {
        const document = JSON.parse(await readFile(thesisPath(), 'utf8'))
        if (!validThesis(document)) throw new Error('Invalid saved thesis')
        return { title: document.title, body: document.body }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { title: '# Thesis', body: '' }
        throw error
    }
}

export async function writeThesis(document: ThesisDocument) {
    if (!validThesis(document)) throw new Error('Invalid thesis')
    const destination = thesisPath()
    await mkdir(path.dirname(destination), { recursive: true })
    const temporary = `${destination}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify({ title: document.title, body: document.body }), { mode: 0o600 })
    await rename(temporary, destination)
}
