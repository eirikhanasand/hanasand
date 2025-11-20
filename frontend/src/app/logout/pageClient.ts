'use client'

import config from '@/config'
import { getCookie, removeCookies } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LogoutPageClient({ path }: { path?: string }) {
    const router = useRouter()

    useEffect(() => {
        (async () => {
            try {
                const id = getCookie('id')
                removeCookies('name', 'access_token', 'id', 'avatar', 'roles')
                const searchParams = new URLSearchParams(window.location.search)
                const queryString = searchParams.toString()
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

                if (id) {
                    const response = await fetch(`${config.url.api}/auth/logout/${id}`, {
                        signal: controller.signal
                    })
                    clearTimeout(timeout)
                    if (!response.ok) {
                        throw new Error(await response.text())
                    }
                }

                if (path) {
                    router.push(path)
                } else {
                    router.push(`/?${queryString}&logout=true`)
                }
            } catch (error) {
                console.log(error)
                router.push('/?logout=true&error=true')
            }
        })()
    })
}
