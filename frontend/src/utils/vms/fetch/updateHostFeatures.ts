import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import fetchWithRetry from '@/utils/fetchWithRetry'

type HostFeaturePatch = {
    always_running_enabled?: boolean
    failover_enabled?: boolean
}

export async function updateHostFeatures(vmName: string, patch: HostFeaturePatch): Promise<VM | string> {
    try {
        const token = safeDecode(getCookie('access_token') || '')
        const userId = getCookie('id')
        if (!token || !userId) {
            return 'Please log in to manage host options.'
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${encodeURIComponent(vmName)}/host-features`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                id: userId,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(patch),
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })
        const data = await response.json()
        if (!response.ok) {
            return data?.error || 'Unable to update host options.'
        }

        return data as VM
    } catch (error) {
        return error instanceof Error ? error.message : 'Unable to update host options.'
    }
}

export async function failoverVm(vmName: string): Promise<{ vm: VM, message: string } | string> {
    try {
        const token = safeDecode(getCookie('access_token') || '')
        const userId = getCookie('id')
        if (!token || !userId) {
            return 'Please log in to fail over this host.'
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${encodeURIComponent(vmName)}/failover`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                id: userId,
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })
        const data = await response.json()
        if (!response.ok) {
            return data?.error || 'Unable to fail over host.'
        }

        return data as { vm: VM, message: string }
    } catch (error) {
        return error instanceof Error ? error.message : 'Unable to fail over host.'
    }
}

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}
