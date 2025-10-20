'use client'

import { useEffect, useState } from 'react'
import Notify from '../notify/notify'
import { useRouter } from 'next/navigation'

export default function ArticleNotification({ message }: { message: string }) {
    const [error, setError] = useState<string | null>(message)
    const router = useRouter()

    useEffect(() => {
        if (!error) {
            return
        }

        const timeout = setTimeout(() => {
            setError(null)
            router.push('/articles')
        }, 5000)

        return () => clearTimeout(timeout)
    }, [error])

    return error ? (
        <div className='absolute top-0 left-0 p-10 mt-10 grid place-items-center w-full'>
            <Notify message={error} />
        </div>
    ) : null
}
