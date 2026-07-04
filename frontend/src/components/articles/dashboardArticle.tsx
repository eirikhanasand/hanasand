'use client'

import useKeyPress from '@/hooks/keyPressed'
import deleteArticle from '@/utils/articles/deleteArticle'
import { FileText, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import ErrorNotice from '../error/errorNotice'

export default function DashboardArticle({ article }: { article: Article }) {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const router = useRouter()

    async function handleClick() {
        if (!keys['shift']) {
            router.push(`/articles/${article.id}`)
        }

        if (keys['shift']) {
            const result = await deleteArticle(article.id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className='group grid gap-2'>
            <button
                type='button'
                onClick={handleClick}
                className={`flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg p-2 text-left transition ${keys['shift'] ? 'border border-ui-danger/40 bg-ui-danger/10 text-ui-danger hover:bg-ui-danger/15' : 'text-ui-text hover:bg-ui-raised'}`}
            >
                <span className='flex min-w-0 items-center gap-2'>
                    <FileText className='h-4 w-4 shrink-0 text-ui-primary' />
                    <span className='min-w-0 truncate text-sm'>{article.title || article.id}</span>
                </span>
                {keys['shift'] && <Trash2 className='h-4 w-4 shrink-0 text-ui-danger' />}
            </button>
            <ErrorNotice compact variant='success' message={deleted ? `Deleted article ${article.id}.` : null} />
            <ErrorNotice compact message={error as string | null} />
        </div>
    )
}
