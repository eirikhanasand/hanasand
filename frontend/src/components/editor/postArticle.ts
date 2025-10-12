import config from '@/config'
import { getCookie } from '@/utils/cookies'

export async function postArticle(article: string, text: string[]): Promise<void | string> {
    const token = getCookie('token')
    const name = getCookie('name')

    if (token && name) {
        const response = await fetch(`${config.url.api}/article`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                username: name,
                article,
                text
            }),
        })

        if (!response.ok) {
            const data = await response.json()

            throw Error(data.error)
        }

        return await response.json()
    }

    return 'Please log in to add articles'
}
