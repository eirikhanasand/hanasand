'use client'

import { useSearchParams } from 'next/navigation'
import ArticleNotification from './articleNotification'

export default function ArticleNotificationFromSearchParams() {
    const params = useSearchParams()
    const error = params.get('error')
    const path = params.get('path')
    const message = error === '404' ? `The article '${path || ''}' does not exist.` : error

    return message ? <ArticleNotification message={message} /> : null
}
