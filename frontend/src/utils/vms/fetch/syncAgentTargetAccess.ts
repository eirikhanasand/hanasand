'use client'

import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

type SyncScope = 'current_user' | 'all_access_users'

type SyncAgentTargetAccessResult = {
    status: number
    message: string
    body: {
        ok: boolean
        vmName: string
        scope: SyncScope
        triggeredBy: string
        syncedUserIds: string[]
        certificateCount: number
        received: number
        added: number
        total: number
        updatedAt: string
        notes: string[]
    } | null
}

export default async function syncAgentTargetAccess(vmName: string, scope: SyncScope = 'current_user'): Promise<SyncAgentTargetAccessResult> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to synchronize VM access.',
                body: null,
            }
        }

        const response = await fetchWithRetry(`${config.url.api}/vm/${encodeURIComponent(vmName)}/agent-target/sync-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                id,
            },
            body: JSON.stringify({ scope }),
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const text = await response.text()
        const payload = text ? JSON.parse(text) as SyncAgentTargetAccessResult['body'] & { error?: string } : null

        if (!response.ok) {
            return {
                status: response.status,
                message: payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                    ? payload.error
                    : `Failed to synchronize access for ${vmName}.`,
                body: null,
            }
        }

        return {
            status: response.status,
            message: `Synchronized access for ${vmName}.`,
            body: payload as SyncAgentTargetAccessResult['body'],
        }
    } catch {
        return {
            status: 500,
            message: `Failed to synchronize access for ${vmName}.`,
            body: null,
        }
    }
}
