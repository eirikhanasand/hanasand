import config from '#constants'

export default async function getStats() {
    try {
        const response = await fetch(`${config.internal_api}/stats`, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_internal'
            }
        })

        if (!response.ok) {
            return { error: 'Failed to get data from internal API.'}
        }

        const data = await response.json()
        return { status: 200, data }
    } catch (error) {
        console.error(`Error fetching stats: ${error}`)
        return { status: 500, data: { error: 'Failed to fetch stats.' } }
    }
}
