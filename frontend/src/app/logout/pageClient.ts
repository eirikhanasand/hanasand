'use client'

import config from '@/config'
import { getCookie, removeCookies } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LogoutPageClient({ path }: { path?: string }) {
    const router = useRouter()

    useEffect(() => {
        (async () => {
            const id = getCookie('id')
            removeCookies('name', 'access_token', 'id', 'avatar', 'roles')
            const searchParams = new URLSearchParams(window.location.search)
            const queryString = searchParams.toString()

            if (id) {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
                fetch(`${config.url.api}/auth/logout/${id}`, {
                    signal: controller.signal
                }).catch(() => null).finally(() => clearTimeout(timeout))
            }

            const safePath = getSafeLocalPath(path)
            if (safePath) {
                router.push(safePath)
            } else {
                router.push(`/?${queryString}&logout=true`)
            }
        })()
    })
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
