import config from '#constants'

export default async function checkPwned(password: string): Promise<{ count: number } | { ok: true, error?: string }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 750)

    try {
        const response = await fetch(config.pwned, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password }),
            signal: controller.signal,
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Error occured while querying pwned API.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        clearTimeout(timeout)
        console.log('Unable to fetch pwned')
        return { ok: true, error: 'Unable to fetch pwned' }
    }
}
