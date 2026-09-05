import config from '@/config'
import tokenIsValid from '@/utils/proxy/tokenIsValid'

export type ThesisDocument = { title: string, body: string, revision: number }

export async function canEditThesis(token?: string, id?: string) {
    if (!token || id !== 'eirikhanasand') return false
    const auth = await tokenIsValid(token, id)
    return auth.state === 'valid'
}

export function validThesis(value: unknown): value is ThesisDocument {
    if (!value || typeof value !== 'object') return false
    const document = value as ThesisDocument
    return typeof document.title === 'string' && document.title.trim().length > 0
        && document.title.length <= 500 && !/[\r\n]/.test(document.title)
        && typeof document.body === 'string' && document.body.length <= 1_000_000
        && Number.isSafeInteger(document.revision) && document.revision >= 0
}

export async function readThesis(): Promise<ThesisDocument> {
    const response = await fetch(`${config.url.api}/thesis`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error('The thesis could not be loaded.')
    const document = await response.json()
    if (!validThesis(document)) throw new Error('Invalid saved thesis')
    return document
}

export async function writeThesis(document: ThesisDocument, token: string, id: string) {
    return fetch(`${config.url.api}/thesis`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, id },
        body: JSON.stringify(document),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
    })
}
