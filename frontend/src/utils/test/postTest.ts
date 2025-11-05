import config from '@/config'

type PostTestProps = {
    url: string
    timeout?: number
    stages?: object
}

export async function postTest({ url, timeout, stages }: PostTestProps): Promise<Test | null> {
    try {
        const res = await fetch(`${config.url.api}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, timeout, stages }),
        })

        if (!res.ok) {
            throw new Error('Failed to create test')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(`Error creating test: ${error}`)
        return null
    }
}
