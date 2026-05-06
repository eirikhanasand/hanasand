'use client'

import { getCookie, removeCookies, setCookie } from '@/utils/cookies/cookies'

export function impersonationHeaders(): Record<string, string> {
    const target = getCookie('impersonating_id')
    return target ? { 'x-impersonate-id': target } : {}
}

export function startImpersonating(id: string, name?: string | null) {
    setCookie('impersonating_id', id, 1)
    setCookie('impersonating_name', name || id, 1)
}

export function stopImpersonating() {
    removeCookies('impersonating_id', 'impersonating_name')
}
