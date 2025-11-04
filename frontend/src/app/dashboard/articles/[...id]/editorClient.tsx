'use client'

import Editor from '@/components/editor/editor'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteArticle from '@/utils/articles/deleteArticle'
import { Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function EditorClient({ article }: { article: Article }) {
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const name = article.id.replace('.md', '')
    const text = editing ? `Editing ${name}` : `Click to edit ${name}`

    async function handleDelete() {
        const result = await deleteArticle(article.id)
        if (result.status === 200) {
            router.push(`/dashboard/articles?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    useClearStateAfter({ condition: error, set: setError, timeout: 5000 })

    return (
        <div className={`grid gap-2 ${editing ? '' : 'px-10 md:px-[20vw]'}`}>
            <h1 className='font-semibold text-2xl'>{text}</h1>
            <Editor
                editing={editing}
                setEditing={setEditing}
                className='bg-light rounded-lg p-2 glow-blue-small'
                id={article.id}
                content={article.content.split('\n')}
            />
            <div onClick={handleDelete} className='bg-light hover:bg-red-500 cursor-pointer py-2 px-6 flex gap-2 rounded-lg w-fit place-self-end mt-10'>
                <Trash />
                <h1 className='font-semibold'>Delete</h1>
            </div>
        </div>
    )
}
