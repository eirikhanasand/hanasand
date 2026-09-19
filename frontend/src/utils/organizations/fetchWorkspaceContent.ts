import config from '@/config'
import { cookies } from 'next/headers'
import { activeOrganizationId } from './serverWorkspace'

export default async function fetchWorkspaceContent<T>(kind: 'articles' | 'thoughts'): Promise<T[]> {
    const store = await cookies()
    const organizationId = await activeOrganizationId()
    const headers: Record<string, string> = {
        Authorization: `Bearer ${store.get('access_token')?.value || ''}`,
        id: store.get('id')?.value || '',
    }
    if (organizationId) headers['x-organization-id'] = organizationId
    const impersonationToken = store.get('impersonation_token')?.value
    if (impersonationToken) headers['x-impersonation-token'] = impersonationToken
    const response = await fetch(`${config.url.api}/${kind}?workspace=true`, {
        headers, cache: 'no-store', signal: AbortSignal.timeout(config.abortTimeout),
    })
    if (!response.ok) throw new Error(`Could not load ${kind}.`)
    return response.json()
}
