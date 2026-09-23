import config from '@/config'
import { cookies } from 'next/headers'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import DetectionRules, { type InitialRules } from './detection-rules'
import type { RuleCategory } from './rule-categories'

export default async function ServerRules({ category }: { category: RuleCategory }) {
    const [store, organizationId] = await Promise.all([cookies(), activeOrganizationId()])
    const initial: InitialRules = { organizationId: organizationId || '', category, rules: [], canManageRetention: false }
    const token = store.get('access_token')?.value
    const id = store.get('id')?.value
    if (organizationId) {
        if (!token || !id) initial.error = 'Sign in to load rules.'
        else {
            try {
                const headers = new Headers({ Authorization: `Bearer ${token}`, id })
                const impersonation = store.get('impersonation_token')?.value
                if (impersonation) headers.set('x-impersonation-token', impersonation)
                const query = new URLSearchParams({ organizationId, view: 'list', category })
                const response = await fetch(`${config.url.api}/mill/rules?${query}`, {
                    headers, cache: 'no-store', signal: AbortSignal.timeout(12_000),
                })
                if (!response.ok) throw new Error('Rules request failed.')
                const payload = await response.json()
                if (!Array.isArray(payload.rules)) throw new Error('Invalid rules response.')
                initial.rules = payload.rules
                initial.canManageRetention = payload.canManageRetention === true
            } catch {
                initial.error = 'Unable to load rules. Reload the page to try again.'
            }
        }
    }
    return <DetectionRules key={`${organizationId}:${category}`} category={category} initial={initial} />
}
