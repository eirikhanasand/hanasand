'use client'

import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function postVM(vm: Partial<VM>): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to post vms.'
            }
        }

        const response = await fetchWithRetry(`${config.url.api}/vm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                id
            },
            body: JSON.stringify({ ...vm }),
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (response.status === 409) {
            throw new Error('conflict')
        }

        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Created VM ${vm.name}.`
        }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.message === 'conflict') {
            return {
                status: 409,
                message: `A VM with the name ${vm.name} already exists.`
            }
        }

        return {
            status: 500,
            message: `Failed to create VM ${vm.name}.`
        }
    }
}
