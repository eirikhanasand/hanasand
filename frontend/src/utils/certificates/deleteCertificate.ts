'use client'

import config from '@/config'
import { getCookie } from '../cookies'

export default async function deleteCertificate(id: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to delete certificates.'
            }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const response = await fetch(`${config.url.api}/certificate/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'id': id
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Deleted certificate ${id}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete certificate ${id}.`
        }
    }
}
