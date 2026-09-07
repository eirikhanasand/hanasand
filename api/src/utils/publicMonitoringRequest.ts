import { lookup } from 'node:dns/promises'
import { request as httpRequest, type RequestOptions, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import ipaddr from 'ipaddr.js'

type Address = { address: string, family: number }
export type MonitoringResolver = (hostname: string, options: { all: true, verbatim: true }) => Promise<Address[]>
const blocked = () => new Error('Monitoring destinations must resolve only to public IP addresses.')

export function isPublicMonitoringAddress(value: string): boolean {
    if (!isIP(value)) return false
    const address = ipaddr.parse(value)
    if (address.range() !== 'unicast') return false
    if (address.kind() === 'ipv6') {
        // Permit global unicast only; exclude protocol assignments and documentation space.
        return address.match(ipaddr.parseCIDR('2000::/3'))
            && !address.match(ipaddr.parseCIDR('2001::/23'))
            && !address.match(ipaddr.parseCIDR('3fff::/20'))
    }
    return true
}

export function monitoringUrl(value: string | URL): URL {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Monitoring URLs must use HTTP or HTTPS without embedded credentials.')
    }
    return url
}

export async function resolveMonitoringAddresses(host: string, signal: AbortSignal, resolver: MonitoringResolver = lookup): Promise<Address[]> {
    signal.throwIfAborted()
    const hostname = host.replace(/^\[|\]$/g, '').toLowerCase()
    if (!hostname || hostname.includes('%') || /(^|\.)(localhost|local|internal)\.?$/.test(hostname)) throw blocked()
    const family = isIP(hostname)
    const addresses = family ? [{ address: hostname, family }] : await new Promise<Address[]>((resolve, reject) => {
        const abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        resolver(hostname, { all: true, verbatim: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
    signal.throwIfAborted()
    if (!addresses.length || addresses.some(item => !isPublicMonitoringAddress(item.address) || isIP(item.address) !== item.family)) throw blocked()
    return addresses
}

export function monitoringLookup(addresses: Address[]): LookupFunction {
    // Never fall back to DNS during connection establishment (including retries by the runtime).
    return (_hostname, options, callback) => {
        const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : Number(options.family || 0)
        const matching = addresses.filter(item => !family || item.family === family)
        if (!matching.length) return callback(Object.assign(blocked(), { code: 'ENOTFOUND' }), options.all ? [] : '', family)
        if (options.all) callback(null, matching)
        else callback(null, matching[0].address, matching[0].family)
    }
}

type MonitoringRequestOptions = {
    method?: 'GET' | 'POST'
    userAgent?: string | null
    followRedirects: boolean
    timeoutMs: number
    readBody?: boolean
}
type Transport = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ReturnType<typeof httpRequest>
const transport: Transport = (url, options, callback) => (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, options, callback)

export async function publicMonitoringRequest(value: string | URL, options: MonitoringRequestOptions, resolver: MonitoringResolver = lookup, send: Transport = transport) {
    let url = monitoringUrl(value)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('Monitoring request timed out.', 'TimeoutError')), options.timeoutMs)
    const { signal } = controller
    let method = options.method || 'GET'
    try {
        for (let redirects = 0; ; redirects++) {
            const addresses = await resolveMonitoringAddresses(url.hostname, signal, resolver)
            const result = await new Promise<{ status: number, location?: string, body: string }>((resolve, reject) => {
                const request = send(url, {
                    method, agent: false, lookup: monitoringLookup(addresses), signal,
                    headers: options.userAgent ? { 'user-agent': options.userAgent } : undefined,
                }, response => {
                    const status = response.statusCode || 0
                    const location = response.headers.location
                    if (!options.readBody || options.followRedirects && location && [301, 302, 303, 307, 308].includes(status)) {
                        resolve({ status, location, body: '' })
                        response.destroy()
                        return
                    }
                    const chunks: Buffer[] = []
                    let size = 0
                    response.on('data', (chunk: Buffer) => {
                        size += chunk.length
                        if (size > 1_048_576) {
                            const error = new Error('Monitoring source exceeds the 1 MiB response limit.')
                            reject(error)
                            response.destroy(error)
                            request.destroy(error)
                        } else chunks.push(chunk)
                    })
                    response.once('error', reject)
                    response.once('aborted', () => reject(new Error('Monitoring response ended before the body was complete.')))
                    response.once('end', () => resolve({ status, location, body: Buffer.concat(chunks).toString('utf8') }))
                })
                request.once('error', reject)
                request.end()
            })
            if (!options.followRedirects || !result.location || ![301, 302, 303, 307, 308].includes(result.status)) return result
            if (redirects >= 10) throw new Error('Monitoring source exceeded the redirect limit.')
            url = monitoringUrl(new URL(result.location, url))
            if (result.status === 303 || method === 'POST' && [301, 302].includes(result.status)) method = 'GET'
        }
    } finally {
        clearTimeout(timer)
    }
}
