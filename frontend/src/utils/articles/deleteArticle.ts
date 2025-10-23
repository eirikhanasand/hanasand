'use client'

import config from '@/config'
import { getCookie } from '../cookies'

export default async function deleteArticle(id: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to delete articles.'
            }
        }

        const response = await fetch(`${config.url.api}/article/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'id': id
            }
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Deleted article ${id}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete article ${id}.`
        }
    }
}
