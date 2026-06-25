import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

type PostTestProps = {
    url: string
    timeout?: number
    stages?: object
}

type PostTestResult =
    | { ok: true, test: Test }
    | { ok: false, error: string, quota?: LoadTestQuota }

const loadTestClientIdStorageKey = 'hanasand:load-testing-client-id'

export async function postTest({ url, timeout, stages }: PostTestProps): Promise<PostTestResult> {
    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const id = getCookie('id')
        const headers = new Headers({ 'Content-Type': 'application/json' })
        if (id) {
            headers.set('id', id)
        } else {
            headers.set('x-load-test-client-id', getOrCreateLoadTestClientId())
        }

        const response = await fetch(`${config.url.api}/test`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url, timeout, stages }),
            signal: controller.signal
        })

        clearTimeout(fetchTimeout)
        const data = await response.json().catch(() => null)
        if (!response.ok) {
            return {
                ok: false,
                error: data?.error || 'Failed to create test.',
                quota: data?.quota
            }
        }

        return { ok: true, test: data }
    } catch (error) {
        console.error(`Error creating test: ${error}`)
        return { ok: false, error: 'Please try again later.' }
    } finally {
        clearTimeout(fetchTimeout)
    }
}

function getOrCreateLoadTestClientId() {
    try {
        const existing = window.localStorage.getItem(loadTestClientIdStorageKey)
        if (existing) {
            return existing
        }
        const next = crypto.randomUUID()
        window.localStorage.setItem(loadTestClientIdStorageKey, next)
        return next
    } catch {
        return 'browser-storage-unavailable'
    }
}
