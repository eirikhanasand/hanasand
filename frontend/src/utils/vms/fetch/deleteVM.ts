'use client'

import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function deleteVM(vmId: string, confirmation: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to delete vms.'
            }
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${encodeURIComponent(vmId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, id, 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmation }),
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) return { status: response.status, message: payload.error || 'Unable to stop the VM. Try again.' }

        return {
            status: response.status,
            message: 'VM stopped. You can restore it for 30 days.'
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete vm ${vmId}.`
        }
    }
}
