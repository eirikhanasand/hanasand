export const dynamic = 'force-static'

export function GET() {
    return new Response(
        [
            'Contact: mailto:security@hanasand.com',
            'Canonical: https://hanasand.com/.well-known/security.txt',
            'Preferred-Languages: en',
            'Expires: 2027-05-14T00:00:00Z',
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
