export const dynamic = 'force-static'

export function GET() {
    return new Response(null, {
        status: 308,
        headers: {
            Location: '/manifest.json',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
