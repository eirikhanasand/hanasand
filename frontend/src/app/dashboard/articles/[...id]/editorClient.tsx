'use client'

import Editor from '@/components/editor/editor'
import { useState } from 'react'

export default function Editorclient({ article }: { article: Article }) {
    const [editing, setEditing] = useState(false)
    const name = article.id.replace('.md', '')
    const text = editing ? `Editing ${name}` : `Click to edit ${name}`

    return (
        <div className={`grid gap-2 ${editing ? '' : 'px-[20vw]'}`}>
            <h1 className='font-semibold text-2xl'>{text}</h1>
            <Editor
                setEditing={setEditing}
                className='bg-light rounded-lg p-2 glow-blue-small'
                id={article.id}
                content={article.content.split('\n')}
            />
        </div>
    )
}
