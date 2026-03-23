import config from '#constants'

export default async function getDocker() {
    try {
        const response = await fetch(`${config.internal_api}/docker`, {
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
        console.error(`Error fetching docker: ${error}`)
        return { status: 500, data: { error: 'Failed to fetch docker.' } }
    }
}
