'use client'

import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function deleteVM(vmId: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to delete vms.'
            }
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${vmId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, id },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Deleted VM ${vmId}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete vm ${vmId}.`
        }
    }
}
