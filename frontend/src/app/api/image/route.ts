import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    let url = searchParams.get('url')
    if (!url) {
        return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
    }

    try {
        if (url.toString().includes('https://')) {
            const parts = url.toString().split('https://')
            if (parts.length > 2) {
                url = `https://${parts[1]}`
            }
        }

        let buffer: ArrayBuffer
        let contentType: string

        if (url.includes('tenor.com')) {
            const result = await fetchTenorDirectMedia(url)
            buffer = result.buffer
            contentType = result.contentType
        } else {
            const response = await fetch(url)
            if (!response.ok) {
                console.log(await response.text())
                throw new Error('Failed to fetch URL')
            }

            contentType = response.headers.get('content-type') || 'application/octet-stream'
            buffer = await response.arrayBuffer()
        }

        return new NextResponse(Buffer.from(buffer), {
            headers: { 'Content-Type': contentType },
        })
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 })
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
            return { buffer: await response.arrayBuffer(), contentType }
        }

        return { buffer: await response.arrayBuffer(), contentType }
    } catch (error) {
        console.error(`Error fetching Tenor media: ${error}`)
        throw error
    }
}
