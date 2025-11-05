import config from '@/config'

export default async function postPwned(password: string): Promise<Breach | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)

    try {
        const res = await fetch(`${config.url.api}/pwned`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!res.ok) {
            throw new Error('Failed to check password')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(`Error checking password: ${error}`)
        return null
    }
}
