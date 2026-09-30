'use client'

import config from '@/config'
import { getCookie, removeCookies } from '@/utils/cookies/cookies'
import { useEffect } from 'react'

export default function LogoutPageClient({ path }: { path?: string }) {
    useEffect(() => {
        const id = getCookie('id')
        const accessToken = getCookie('access_token')
        try {
            for (const key of Object.keys(sessionStorage)) {
                if (key.startsWith('account-delete-confirmation:')) sessionStorage.removeItem(key)
            }
        } catch { /* Storage may be disabled; keep asking for confirmation. */ }
        removeCookies('name', 'access_token', 'id', 'avatar', 'roles', 'session_expires_at', 'auth_checked_at', 'impersonation_token', 'impersonating_id', 'impersonating_name')

        const queryString = new URLSearchParams(window.location.search).toString()
        const destination = getSafeLocalPath(path) || `/?${queryString}&logout=true`

        if (id && accessToken) {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
            fetch(`${config.url.api}/auth/logout/${id}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: controller.signal,
                keepalive: true,
            }).catch(() => null).finally(() => clearTimeout(timeout))
        }

        // Client-side navigation can keep the shared header mounted with its stale token prop.
        window.location.replace(destination)
    }, [path])
}

function getSafeLocalPath(path?: string) {
    if (!path || !path.startsWith('/') || path.startsWith('//') || hasControlCharacter(path)) {
        return ''
    }

    try {
        const parsed = new URL(path, window.location.origin)
        if (parsed.origin !== window.location.origin) {
            return ''
        }

        return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
        return ''
    }
}

function hasControlCharacter(value: string) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (code < 32 || code === 127) {
            return true
        }
    }

    return false
}
