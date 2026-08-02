'use client'

import { getCookie } from '@/utils/cookies/cookies'

export type AptUpdate = { package: string, version: string, repo: string, origin: string, security: boolean, first_seen: number }
export type AptUpdateStatus = {
    schema_version?: number
    host?: string
    run_id?: string
    checked_at?: string
    status?: 'ok' | 'pending' | 'failed' | 'unknown'
    last_error?: string | null
    pending_updates?: AptUpdate[]
    installed_packages?: Array<{ package: string }>
    last_updated_packages?: string[]
    last_update_at?: string | null
    policy?: { non_security_delay_hours?: number, security_install?: string, allowed_origin?: string, repository_verification?: string }
}
export type AptUpdateHistory = { run_id: string, status: string, occurred_at: string, packages: string[], error: string | null }

export async function fetchAptUpdates() {
    const response = await fetch('/api/backend/system/updates', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${getCookie('access_token') || ''}`, id: getCookie('id') || '' },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(body.error || 'Unable to load host update status.'))
    return body as { status: AptUpdateStatus, history: AptUpdateHistory[] }
}
