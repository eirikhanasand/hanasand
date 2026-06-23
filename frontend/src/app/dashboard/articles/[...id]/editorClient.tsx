'use client'

import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteArticle from '@/utils/articles/deleteArticle'
import { FileText, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function EditorClient({ article }: { article: Article }) {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const name = article.id.replace('.md', '')
    const text = editing ? `Editing ${name}` : name

    async function handleDelete() {
        const result = await deleteArticle(article.id)
        if (result.status === 200) {
            router.push(`/dashboard/articles?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    return (
        <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
            <div className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-[#3056d3]'>
                        <FileText className='h-4 w-4 shrink-0' />
                        <p className='text-xs font-semibold uppercase text-[#3056d3]'>Article editor</p>
                    </div>
                    <h1 className='mt-2 truncate text-xl font-medium text-[#171a21]'>{text}</h1>
                </div>
                <button
                    type='button'
                    onClick={handleDelete}
                    className='inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100'
                >
                    <Trash className='h-4 w-4' />
                    Delete
                </button>
            </div>
            <ErrorNotice compact message={error as string | null} />
            <Editor
                editing={editing}
                setEditing={setEditing}
                className='rounded-lg border border-[#dfe5ee] bg-white p-2 shadow-sm'
                id={article.id}
                content={article.content.split('\n')}
            />
        </div>
    )
}
