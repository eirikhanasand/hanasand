import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import config from '@/config'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import RateLimitsPageClient from './pageClient'
import type { RateLimitRoute, RateLimitSettings } from './pageClient'

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

    return (
        <DashboardPage className='h-full'>
            <DashboardHeader
                title='Rate Limits'
                eyebrow='System'
                description='Tune global API pressure controls without redeploying the stack.'
            />
            <RateLimitsPageClient
                initialSettings={payload?.settings && typeof payload.settings === 'object' ? payload.settings as RateLimitSettings : null}
                routes={Array.isArray(payload?.routes) ? payload.routes as RateLimitRoute[] : []}
            />
        </DashboardPage>
    )
}
