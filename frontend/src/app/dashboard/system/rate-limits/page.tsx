import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import config from '@/config'
import { DashboardPage } from '@/components/dashboard/ui'
import RateLimitsPageClient from './pageClient'

export default async function RateLimitsPage() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value || ''
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system/rate-limits%26expired=true')
    }

    const response = await fetch(`${config.url.api}/rate-limit/settings`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id,
        },
        cache: 'no-store',
    }).catch(() => null)

    const payload = response?.ok ? await response.json().catch(() => null) : null
    const apiKeysResponse = await fetch(`${config.url.api}/rate-limit/keys`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id,
        },
        cache: 'no-store',
    }).catch(() => null)
    const apiKeysPayload = apiKeysResponse?.ok ? await apiKeysResponse.json().catch(() => null) : null

    return (
        <DashboardPage className='h-full'>
            <RateLimitsPageClient
                initialSettings={payload?.settings && typeof payload.settings === 'object' ? payload.settings as RateLimitSettings : null}
                routes={Array.isArray(payload?.routes) ? payload.routes as RateLimitRoute[] : []}
                initialApiKeys={Array.isArray(apiKeysPayload?.apiKeys) ? apiKeysPayload.apiKeys as ApiKeySummary[] : []}
            />
        </DashboardPage>
    )
}
