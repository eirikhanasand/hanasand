import { cookies } from 'next/headers'
import { readWorkspace, WORKSPACE_COOKIE } from './workspace'
export async function activeOrganizationId() {
    const store = await cookies()
    return readWorkspace(store.get(WORKSPACE_COOKIE)?.value, store.get('impersonating_id')?.value || store.get('id')?.value || '')?.organizationId || undefined
}
