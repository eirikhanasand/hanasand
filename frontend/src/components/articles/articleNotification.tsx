'use client'

import Notify from '../notify/notify'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function ArticleNotification({ message }: { message: string }) {
    const router = useRouter()
    const { condition: error } = useClearStateAfter({ initialState: message, onClear: () => router.push('/articles')})

    return error ? (
        <div className='absolute top-0 left-0 p-10 mt-10 grid place-items-center w-full'>
            <Notify message={error} />
        </div>
    ) : null
}
