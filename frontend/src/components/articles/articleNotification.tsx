'use client'

import { useState } from 'react'
import Notify from '../notify/notify'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function ArticleNotification({ message }: { message: string }) {
    const [error, setError] = useState<string | null>(message)
    const router = useRouter()

    useClearStateAfter({ condition: error, set: setError, timeout: 5000, onClear: () => router.push('/articles') })

    return error ? (
        <div className='absolute top-0 left-0 p-10 mt-10 grid place-items-center w-full'>
            <Notify message={error} />
        </div>
    ) : null
}
