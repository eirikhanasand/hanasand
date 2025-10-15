import config from '#constants'

export default async function checkBloom(password: string): Promise<{file: string} | null> {
    try {
        const response = await fetch(config.bloom, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(password)
        })

        if (!response.ok) {
            throw new Error("Error occured while querying bloom filter")
        }
        
        const data = await response.json()
        return data
    } catch (error) {
        console.log("Unable to fetch bloom")
        return null
    }
}
