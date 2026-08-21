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
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system/rates%26expired=true')
    }

    const headers = {
        Authorization: `Bearer ${decodeURIComponent(token)}`,
        id,
    }
    const [response, apiKeysResponse] = await Promise.all([
        fetch(`${config.url.api}/rate-limit/settings`, { headers, cache: 'no-store' }).catch(() => null),
        fetch(`${config.url.api}/rate-limit/keys`, { headers, cache: 'no-store' }).catch(() => null),
    ])
    const [payload, apiKeysPayload] = await Promise.all([
        response?.ok ? response.json().catch(() => null) : null,
        apiKeysResponse?.ok ? apiKeysResponse.json().catch(() => null) : null,
    ])

    return (
        <DashboardPage className='h-full'>
            <RateLimitsPageClient
                initialSettings={payload?.settings && typeof payload.settings === 'object' ? payload.settings as RateLimitSettings : null}
                routes={Array.isArray(payload?.routes) ? payload.routes as RateLimitRoute[] : []}
                tierPresets={Array.isArray(payload?.tierPresets) ? payload.tierPresets as ApiKeyTierDefinition[] : []}
                initialApiKeys={Array.isArray(apiKeysPayload?.apiKeys) ? apiKeysPayload.apiKeys as ApiKeySummary[] : []}
            />
        </DashboardPage>
    )
}
