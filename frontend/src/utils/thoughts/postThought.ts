'use client'

import config from '@/config'
import { getCookie } from '@/utils/cookies'

export async function postThought(title: string): Promise<{ status: number, message: string }> {
    const token = getCookie('access_token')
    const id = getCookie('id')

    if (!token || !id) {
        return {
            status: 401,
            message: 'Please log in to add thoughts.'
        }
    }

    try {
        const response = await fetch(`${config.url.api}/thoughts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, id })
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
