export const dynamic = 'force-static'

export function GET() {
    return new Response(null, {
        status: 302,
        headers: {
            Location: '/reset-password',
            'Cache-Control': 'no-store',
        },
    })
}
