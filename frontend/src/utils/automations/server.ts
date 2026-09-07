import 'server-only'
import { cookies } from 'next/headers'
import config from '@/config'
import type { AgentAutomation, AgentAutomationRun, MonitoringIssue } from './client'

export type InitialAutomationData = {
    canManageSystem?: boolean
    automations: AgentAutomation[]
    detail?: { automation: AgentAutomation, runs: AgentAutomationRun[], issues?: MonitoringIssue[], total: number, nextPage: number | null }
    error?: string
}

export async function loadAutomations(selectedId?: string, scope?: 'personal'): Promise<InitialAutomationData> {
    const store = await cookies()
    const token = store.get('access_token')?.value
    const id = store.get('id')?.value
    if (!token || !id) return { automations: [], error: 'Sign in to view your automations.' }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, id }
    const impersonation = store.get('impersonation_token')?.value
    if (impersonation) headers['x-impersonation-token'] = impersonation
    async function request<T>(path: string): Promise<T> {
        const response = await fetch(`${config.url.api}/automations${path}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(12000) })
        if (!response.ok) throw new Error('Unable to load automations. Please try again.')
        return response.json() as Promise<T>
    }
    try {
        const { automations, canManageSystem } = await request<{ automations: AgentAutomation[], canManageSystem?: boolean }>(scope ? '?scope=personal' : '')
        if (!automations.length) return { automations, canManageSystem }
        try {
            const detail = await request<NonNullable<InitialAutomationData['detail']>>(`/${encodeURIComponent(automations.find(item => item.id === selectedId)?.id || automations[0].id)}`)
            return { automations, canManageSystem, detail }
        } catch {
            return { automations, canManageSystem, error: 'Unable to load recent checks. Please try again.' }
        }
    } catch {
        return { automations: [], error: 'Unable to load automations. Please try again.' }
    }
}
