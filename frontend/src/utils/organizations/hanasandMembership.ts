import { authApiUrl } from '@/utils/auth/authApiUrl'
type Organization = { slug?: unknown, lifecycleStatus?: unknown }
export async function isHanasandOrganizationMember(token: string, id: string) {
    const response = await fetch(`${authApiUrl().replace(/\/$/, '')}/organizations`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}`, id }, signal: AbortSignal.timeout(10000) })
    if (response.status === 401 || response.status === 403) return false
    if (!response.ok) throw new Error('Organization membership could not be checked.')
    const payload = await response.json() as { organizations?: unknown }
    if (!payload || !Array.isArray(payload.organizations)) throw new Error('Organization membership response was invalid.')
    return payload.organizations.some((value: Organization) => typeof value?.slug === 'string' && value.slug.toLowerCase() === 'hanasand' && value.lifecycleStatus === 'active')
}
