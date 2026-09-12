'use client'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export default async function restoreVM(name: string) {
    try {
        const response = await fetch(`${config.url.api}/vm/${encodeURIComponent(name)}/restore`, {
            method: 'POST', headers: { Authorization: `Bearer ${getCookie('access_token')}`, id: getCookie('id') || '' },
        })
        const payload = await response.json().catch(() => ({}))
        return { status: response.status, message: response.ok ? 'VM restored.' : payload.error || 'Unable to restore the VM. Try again.' }
    } catch { return { status: 503, message: 'Unable to restore the VM. Try again.' } }
}
