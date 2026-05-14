'use client'

import config from '@/config'
import { getCookie } from '../cookies/cookies'

export default async function deleteProject(projectId: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            return {
                status: 401,
                message: 'Please log in to delete projects.'
            }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/project/${projectId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'id': userId
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Deleted project ${projectId}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete project ${projectId}.`
        }
    }
}
