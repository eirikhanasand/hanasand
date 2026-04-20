export const dynamic = 'force-static'

export function GET() {
    return new Response(
        [
            'version: STSv1',
            'mode: enforce',
            'mx: mail.hanasand.com',
            'max_age: 86400',
            '',
        ].join('\n'),
        {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        }
    )
}
