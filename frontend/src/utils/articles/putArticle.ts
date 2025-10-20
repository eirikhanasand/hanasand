import config from '@/config'
import { getCookie } from '@/utils/cookies'

export async function putArticle(id: string, content: string[]): Promise<void | string> {
    const token = getCookie('token')
    const username = getCookie('id')

    if (token && username) {
        const response = await fetch(`${config.url.api}/article/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, content })
        })

        if (!response.ok) {
            const data = await response.json()

            throw Error(data.error)
        }

        return await response.json()
    }

    return 'Please log in to update articles.'
}
