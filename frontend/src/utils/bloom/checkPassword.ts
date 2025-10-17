import config from '@/config'

export default async function postPwned(password: string): Promise<Breach | null> {
    try {
        const res = await fetch(`${config.url.api}/pwned`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        })

        if (!res.ok) {
            throw new Error('Failed to check password')
        }

        const data = await res.json()
        return data
    } catch (err) {
        console.error('Error checking password:', err)
        return null
    }
}
