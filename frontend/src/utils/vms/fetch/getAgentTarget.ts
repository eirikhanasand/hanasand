'use client'

import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function getAgentTarget(vmName: string): Promise<{
    status: number
    message: string
    target: AgentVmTarget | null
}> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to inspect VM targets.',
                target: null,
            }
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${encodeURIComponent(vmName)}/agent-target`, {
            headers: {
                Authorization: `Bearer ${token}`,
                id,
            },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const text = await response.text()
        const payload = text ? JSON.parse(text) as AgentVmTarget & { error?: string } : null

        if (!response.ok) {
            return {
                status: response.status,
                message: payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                    ? payload.error
                    : `Failed to load VM target ${vmName}.`,
                target: null,
            }
        }

        return {
            status: response.status,
            message: `Loaded VM target ${vmName}.`,
            target: payload as AgentVmTarget,
        }
    } catch {
        return {
            status: 500,
            message: `Failed to load VM target ${vmName}.`,
            target: null,
        }
    }
}
