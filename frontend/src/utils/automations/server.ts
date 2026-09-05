import 'server-only'
import { cookies } from 'next/headers'
import config from '@/config'
import type { AgentAutomation, AgentAutomationRun } from './client'

export type InitialAutomationData = {
    automations: AgentAutomation[]
    detail?: { automation: AgentAutomation, runs: AgentAutomationRun[], total: number, nextCursor: string | null }
    error?: string
}

export async function loadAutomations(): Promise<InitialAutomationData> {
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
        const { automations } = await request<{ automations: AgentAutomation[] }>('')
        if (!automations.length) return { automations }
        try {
            const detail = await request<NonNullable<InitialAutomationData['detail']>>(`/${encodeURIComponent(automations[0].id)}`)
            return { automations, detail }
        } catch {
            return { automations, error: 'Unable to load recent checks. Please try again.' }
        }
    } catch {
        return { automations: [], error: 'Unable to load automations. Please try again.' }
    }
}
