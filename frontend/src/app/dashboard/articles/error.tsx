'use client'

import ContentPageError from '@/components/dashboard/ContentPageError'

export default function Error({ reset }: { error: Error & { digest?: string }, reset: () => void }) {
    return <ContentPageError title='Articles' reset={reset} />
}
