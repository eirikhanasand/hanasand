import https from 'node:https'
import { Readable } from 'node:stream'
import config from '#constants'

const addresses: Record<string,string> = { inspur: '128.39.142.218', ovhcloud: '192.99.32.185' }
export const supportedHost = (host: string) => Object.hasOwn(addresses, host)
export const otherHost = (host: string) => host === 'inspur' ? 'ovhcloud' : host === 'ovhcloud' ? 'inspur' : null

// Pin the selected host's address while retaining normal TLS hostname/certificate verification.
export async function internalHostFetch(host: string, path: string, options: RequestInit = {}) {
    if (!supportedHost(host) || !path.startsWith('/vm/') || path.includes('..')) throw new Error('Unsupported container host request.')
    const url = new URL('https://internal.hanasand.com/api' + path)
    const headers = Object.fromEntries(new Headers(options.headers).entries())
    headers.authorization = 'Bearer ' + encodeURIComponent(config.vm_api_token || '')
    return new Promise<Response>((resolve, reject) => {
        const req = https.request(url, {
            method: options.method || 'GET', headers, timeout: 120000,
            lookup: (_hostname, _options, callback) => callback(null, addresses[host], 4),
            signal: options.signal || undefined,
        }, response => {
            const resultHeaders = new Headers()
            for (const [name,value] of Object.entries(response.headers)) if (value !== undefined) resultHeaders.set(name, Array.isArray(value) ? value.join(', ') : value)
            resolve(new Response(Readable.toWeb(response) as ReadableStream, { status: response.statusCode || 502, headers: resultHeaders }))
        })
        req.on('error', reject)
        req.on('timeout', () => req.destroy(new Error('Container host request timed out.')))
        if (options.body instanceof ReadableStream) {
            const stream = Readable.fromWeb(options.body as import('node:stream/web').ReadableStream)
            stream.on('error', error => req.destroy(error)); stream.pipe(req)
        } else req.end(options.body as string | Buffer | undefined)
    })
}
export async function hostJson<T = Record<string,unknown>>(host: string, name: string, suffix = '/recovery', body?: unknown): Promise<T> {
    const response = await internalHostFetch(host, '/vm/' + encodeURIComponent(name) + suffix, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw Object.assign(new Error(result.error || 'Container host request failed.'), { statusCode: response.status })
    return result as T
}
export type HostInstance = { name: string; status: string; type: string; ephemeral: boolean; config: Record<string,string>; expanded_devices: Record<string,Record<string,string>> }
export type HostState = { instance: HostInstance; state: { status: string; network?: Record<string,{ addresses?: Array<{family: string;scope: string;address: string}> }> } }
export const inspectHostVm = (host: string, name: string) => hostJson<HostState>(host, name)
