import config from '@/config'

export default async function getVMDetails(id: string, token: string, userId: string): Promise<VMDetails | null> {
    try {
        const response = await fetch(`${config.url.api}/vm/details/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId
            }
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data: VMDetails = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
