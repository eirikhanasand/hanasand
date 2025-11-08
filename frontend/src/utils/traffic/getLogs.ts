import config from '@/config'

export default async function fetchLogs(sortBy: 'hits' | 'last_seen' = 'last_seen') {
    try {
        const response = await fetch(`${config.url.cdn}/traffic/recent?sort=${sortBy}`)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
