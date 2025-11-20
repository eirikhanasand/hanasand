'use client'

import config from '@/config'
import { getCookie } from '../cookies/cookies'

export default async function deleteProject(id: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to delete projects.'
            }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/project/${id}`, {
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
            message: `Deleted project ${id}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete project ${id}.`
        }
    }
}
