'use client'

import config from '@/config'
import { getCookie, removeCookies } from '@/utils/cookies'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LogoutPageClient({ path }: { path?: string }) {
    const router = useRouter()

    useEffect(() => {
        (async () => {
            try {
                const id = getCookie('id')
                removeCookies('name', 'access_token', 'id', 'avatar')
                const searchParams = new URLSearchParams(window.location.search)
                const queryString = searchParams.toString()

                if (id) {
                    const response = await fetch(`${config.url.api}/auth/logout/${id}`)
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
