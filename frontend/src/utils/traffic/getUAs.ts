import config from '@/config'

export default async function getUAs() {
    try {
        const response = await fetch(`${config.url.cdn}/traffic/uas`)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
