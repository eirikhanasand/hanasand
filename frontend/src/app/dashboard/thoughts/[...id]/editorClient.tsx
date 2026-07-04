'use client'

import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteThought from '@/utils/thoughts/deleteThought'
import { BrainCircuit, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function EditorClient({ thought }: { thought: Thought }) {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const text = editing ? 'Editing thought' : 'Thought'

    async function handleDelete() {
        const result = await deleteThought(thought.id)
        if (result.status === 200) {
            router.push(`/dashboard/thoughts?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    return (
        <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
            <div className='flex items-center justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-ui-primary'>
                        <BrainCircuit className='h-4 w-4 shrink-0' />
                        <p className='text-xs font-semibold uppercase text-ui-primary'>Thought editor</p>
                    </div>
                    <h1 className='mt-2 truncate text-xl font-medium text-ui-text'>{text}</h1>
                </div>
                <button
                    type='button'
                    onClick={handleDelete}
                    className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-danger/40 bg-ui-danger/10 px-3.5 text-sm font-medium text-ui-danger transition hover:bg-ui-danger/15'
                >
                    <Trash className='h-4 w-4' />
                    Delete
                </button>
            </div>
            <ErrorNotice compact message={error as string | null} />
            <Editor
                editing={editing}
                setEditing={setEditing}
                className='rounded-lg border border-ui-border bg-ui-raised p-2 shadow-sm shadow-ui-canvas/20'
                id={thought.id}
                content={thought.title.split('\n')}
            />
        </div>
    )
}
