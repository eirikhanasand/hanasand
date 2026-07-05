import { NextResponse } from 'next/server'

const MAX_PROXY_BYTES = 20 * 1024 * 1024
const PRIVATE_IPV4_RANGES = [
    /^0\./,
    /^10\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
]

class MediaProxyError extends Error {
    constructor(message: string, readonly status: number) {
        super(message)
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    let url = searchParams.get('url')
    if (!url) {
        return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
    }

    if (url.toString().includes('https://')) {
        const parts = url.toString().split('https://')
        if (parts.length > 2) {
            url = `https://${parts[1]}`
        }
    }

    try {
        const parsedUrl = new URL(url)
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return NextResponse.json({ error: 'URL must use http or https' }, { status: 400 })
        }
        if (isBlockedHostname(parsedUrl.hostname)) {
            return NextResponse.json({ error: 'URL must point to a public media host.' }, { status: 400 })
        }
        url = parsedUrl.toString()
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    try {
        let buffer: ArrayBuffer
        let contentType: string

        if (url.includes('tenor.com')) {
            const result = await fetchTenorDirectMedia(url)
            buffer = result.buffer
            contentType = result.contentType
        } else {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error('Failed to fetch URL')
            }

            contentType = response.headers.get('content-type') || 'application/octet-stream'
            assertMediaResponse(response, contentType)
            buffer = await response.arrayBuffer()
        }

        assertMediaSize(buffer.byteLength)

        return new NextResponse(Buffer.from(buffer), {
            headers: {
                'Content-Type': contentType,
                'cache-control': 'no-store',
            },
        })
    } catch (error) {
        const status = error instanceof MediaProxyError ? error.status : 500
        return NextResponse.json({ error: (error as Error).message }, { status })
    }
}

async function fetchTenorDirectMedia(url: string) {
    try {
        let response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`)
        }

        let contentType = response.headers.get('content-type') || ''
        if (url.includes('tenor.com') && contentType.includes('text/html')) {
            const html = await response.text()
            const matches = Array.from(html.matchAll(/https:\/\/[^/]+\/[^\s'']+\.(gif|mp4|webm)/g))
            if (!matches.length) {
                throw new Error('No media URLs found')
            }

            const mediaUrl = matches[0][0].replace('/m/', '/').replace(/^https:\/\/[^/]+/, 'https://c.tenor.com')
            response = await fetch(mediaUrl)

            if (!response.ok) {
                throw new Error('Failed to fetch media URL')
            }

            contentType = response.headers.get('content-type') || 'application/octet-stream'
            assertMediaResponse(response, contentType)
            return { buffer: await response.arrayBuffer(), contentType }
        }

        assertMediaResponse(response, contentType)
        return { buffer: await response.arrayBuffer(), contentType }
    } catch (error) {
        console.error(`Error fetching Tenor media: ${error}`)
        throw error
    }
}

function assertMediaResponse(response: Response, contentType: string) {
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
        throw new MediaProxyError('URL must return an image or video.', 400)
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    assertMediaSize(contentLength)
}

function assertMediaSize(byteLength: number) {
    if (Number.isFinite(byteLength) && byteLength > MAX_PROXY_BYTES) {
        throw new MediaProxyError('Media file is too large.', 413)
    }
}

function isBlockedHostname(hostname: string) {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true
    if (normalized.includes(':')) {
        if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true
        const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
        return mappedIpv4 ? PRIVATE_IPV4_RANGES.some(pattern => pattern.test(mappedIpv4)) : false
    }
    return PRIVATE_IPV4_RANGES.some(pattern => pattern.test(normalized))
}
