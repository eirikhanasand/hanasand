import config from '@/config'

export default async function getDomains() {
    try {
        const response = await fetch(`${config.url.cdn}/traffic/tps?fresh=1`, {
            cache: 'no-store',
        })
        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data = await response.json()
        if (!Array.isArray(data)) {
            return []
        }

        return data.filter((entry) => {
            const name = typeof entry?.name === 'string' ? entry.name : ''
            if (!name) return false
            if (name.startsWith('/')) return false
            if (name.includes(' ')) return false
            return name.includes('.') || name === 'localhost'
        })
    } catch (error) {
        console.log(error)
        return []
    }
}
