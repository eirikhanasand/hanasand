'use client'

import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import fetchThoughtByTitle from '@/utils/thoughts/fetchThoughtByTitle'
import { postThought } from '@/utils/thoughts/postThought'
import { BrainCircuit, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CreateClient() {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [title, setTitle] = useState<string>('')
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const text = editing ? 'Creating thought' : 'Start writing...'

    async function handleCreate() {
        if (!title) {
            return setError('You cannot create an empty thought.')
        }

        const result = await postThought(title)
        if (result.status === 201) {
            return router.push(`/dashboard/thoughts?message=${JSON.stringify(result.message)}`)
        } else {
            return setError(result.message)
        }
    }

    useEffect(() => {
        if (title) {
            (async() => {
                const response = await fetchThoughtByTitle(title)
                if (Array.isArray(response) && response.length > 0) {
                    setError('The thought already exists!')
                }
            })()
        }
    }, [title])

    useEffect(() => {
        if (!title.length) {
            setEditing(false)
        }
    }, [title])

    return (
        <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <div className='flex items-center gap-2 text-orange-200/78'>
                        <BrainCircuit className='h-4 w-4' />
                        <p className='text-xs font-medium uppercase tracking-[0.18em] text-bright/38'>Thought editor</p>
                    </div>
                    <h1 className='mt-2 text-xl font-medium text-bright/92'>{text}</h1>
                </div>
                <button
                    type='button'
                    onClick={handleCreate}
                    className='inline-flex h-9 items-center gap-2 rounded-lg bg-bright/88 px-3.5 text-sm font-medium text-background/90 transition hover:bg-bright'
                >
                    <Plus className='h-4 w-4' />
                    Create
                </button>
            </div>
            <ErrorNotice compact message={error as string | null} />
            <div className='grid w-full gap-5'>
                <Editor
                    editing={editing}
                    setEditing={setEditing}
                    customSaveLogic={true}
                    hideSaveButton
                    className='rounded-lg border border-white/10 bg-white/[0.035] p-2'
                    id={title || ''}
                    content={title.split('\n')}
                    onChange={setTitle}
                />
            </div>
        </div>
    )
}
