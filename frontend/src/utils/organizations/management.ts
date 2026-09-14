import { cache } from 'react'
import { cookies } from 'next/headers'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export const fetchManagementOrganizations = cache(async (accessOnly = false) => {
    const jar = await cookies()
    const token = jar.get('access_token')?.value
    const id = jar.get('id')?.value
    if (!token || !id) return new Response(null, { status: 401 })
    return fetch(`${authApiUrl().replace(/\/$/, '')}/management/organizations${accessOnly ? '?access=1' : ''}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, id, ...(jar.get('impersonation_token')?.value ? { 'x-impersonation-token': jar.get('impersonation_token')!.value } : {}) },
        signal: AbortSignal.timeout(10000),
    })
})

export async function canManageOrganizations() {
    try { return (await fetchManagementOrganizations(true)).ok } catch { return false }
}
