import config from '#constants'

export default async function checkPwned(password: string): Promise<{ count: number } | { ok: true, error?: string }> {
    try {
        const response = await fetch(config.pwned, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        })

        if (!response.ok) {
            throw new Error('Error occured while querying pwned API.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log('Unable to fetch pwned')
        return { ok: true, error: 'Unable to fetch pwned' }
    }
}
