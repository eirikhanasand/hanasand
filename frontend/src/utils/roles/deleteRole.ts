'use client'

import config from '@/config'
import { getCookie } from '../cookies'

export default async function deleteRole(id: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        if (!token) {
            return {
                status: 401,
                message: 'Please log in to delete roles.'
            }
        }

        const response = await fetch(`${config.url.api}/role/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Deleted role ${id}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete role ${id}.`
        }
    }
}
