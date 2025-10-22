'use client'

import config from '@/config'
import { getCookie } from '@/utils/cookies'

export async function postArticle(id: string, content: string): Promise<{ status: number, message: string }> {
    const token = getCookie('token')
    const username = getCookie('id')

    if (!token || !id) {
        return {
            status: 401,
            message: 'Please log in to add articles.'
        }
    }

    try {
        const response = await fetch(`${config.url.api}/article/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id: username, content })
        })
    
        if (!response.ok) {
            throw new Error(await response.text())
        }
    
        const data = await response.json()
        return { status: response.status, message: data }
    } catch (error) {
        console.log(error)
        return { status: 500, message: error as string }
    }
}
