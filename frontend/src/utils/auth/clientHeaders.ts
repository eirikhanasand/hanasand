import { isIP } from 'node:net'

// The public proxy overwrites X-Real-IP. Never forward a client-supplied chain.
export function clientHeaders(headers: Headers): Record<string, string> {
    const ip = (headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',').at(-1) || '').trim()
    return {
        'user-agent': (headers.get('user-agent') || '').slice(0, 1000),
        ...(isIP(ip) ? { 'x-forwarded-for': ip } : {}),
    }
}
