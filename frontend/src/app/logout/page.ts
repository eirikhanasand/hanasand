'use client'

import config from '@/config'
import { removeCookies } from '@/utils/cookies'
import { useEffect } from 'react'

export default function Page() {
    useEffect(() => {
        (async() => {
            try {
                removeCookies('name', 'access_token', 'id', 'avatar')
                const searchParams = new URLSearchParams(window.location.search)
                const queryString = searchParams.toString()
                const response = await fetch(`${config.url.api}/logout`)
    
                if (!response.ok) {
                    throw new Error(await response.text())
                }

                window.location.href = `/?${queryString}&logout=true`
            } catch (error) {
                console.log(error)
                window.location.href = `/?logout=true&error=true`
            }
        })()
    }, [])
}
