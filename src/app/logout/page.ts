'use client'

import config from '@/config'
import { useEffect } from 'react'

export default function Page() {
    useEffect(() => {
        (async() => {
            const response = await fetch(`${config.url.api}/logout`)

            if (!response.ok) {
                throw new Error(await response.text())
            }

            const data = await response.json()
            console.log(data)
            window.location.href = '/?logout=true'
        })()
    }, [])
}
