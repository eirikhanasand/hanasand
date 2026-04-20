import config from '@/config'
import { cookies } from 'next/headers'

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('access_token')?.value
        if (!token) {
            return new Response('Unauthorized', { status: 401 })
        }

        const response = await fetch(`${config.url.beekeeper}/traffic/live`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/event-stream',
                Connection: 'keep-alive',
            },
            cache: 'no-store',
        })

        if (!response.ok || !response.body) {
            return new Response('Failed to connect to traffic stream', { status: response.status || 502 })
        }

        return new Response(response.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch (error) {
        return new Response(error instanceof Error ? error.message : 'Unknown error', { status: 500 })
    }
}
