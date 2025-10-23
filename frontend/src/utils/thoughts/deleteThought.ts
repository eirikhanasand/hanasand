'use client'

import config from '@/config'
import { getCookie } from '../cookies'

export default async function deleteThought(id: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to delete thoughts.'
            }
        }

        const response = await fetch(`${config.url.api}/thought/${id}`, {
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
            message: `Deleted thought ${id}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete thought ${id}.`
        }
    }
}
