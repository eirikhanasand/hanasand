'use client'

import Editor from '@/components/editor/editor'
import Notify from '@/components/notify/notify'
import fetchThoughtByTitle from '@/utils/thoughts/fetchThoughtByTitle'
import { postThought } from '@/utils/thoughts/postThought'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CreateClient() {
    const [error, setError] = useState<string | null>(null)
    const [title, setTitle] = useState<string>('')
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const text = editing ? `Creating thought` : `Start writing...`

    async function handleCreate() {

        if (!title) {
            return setError('You cannot create an empty thought.')
        }

        const result = await postThought(title)
        if (result.status === 200) {
            router.push(`/dashboard/thoughts?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    useEffect(() => {
        if (!error) {
            return
        }

        const timeout = setTimeout(() => {
            setError(null)
        }, 5000)

        return () => clearTimeout(timeout)
    }, [error])

    useEffect(() => {
        if (title) {
            (async() => {
                const response = await fetchThoughtByTitle(title)
                if (Array.isArray(response) && response.length > 0) {
                    setError(`The thought already exists!`)
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
        <div className={`relative grid gap-2 ${editing ? '' : 'px-10 md:px-[20vw]'}`}>
            {error && (
                <div className='w-full rounded-lg grid place-items-center'>
                    <div className='glow-red-small w-fit rounded-lg'>
                        <Notify message={error} className=' min-w-full px-4 bg-light' />
                    </div>
                </div>
            )}
            <h1 className='font-semibold text-2xl'>{text}</h1>
            <div className='grid gap-5 w-full'>
                {title.length > 10 && <h1 className='font-semibold z-10'>Title</h1>}
                <Editor
                    editing={editing}
                    setEditing={setEditing}
                    customSaveLogic={true}
                    hideSaveButton
                    className='bg-light rounded-lg p-2 glow-blue-small'
                    id={title || ''}
                    content={title.split('\n')}
                    onChange={setTitle}
                />
            </div>
            <div onClick={handleCreate} className='bg-light hover:bg-green-500 cursor-pointer py-2 px-6 flex gap-2 rounded-lg w-fit place-self-end mt-10'>
                <Plus />
                <h1 className='font-semibold'>Create</h1>
            </div>
        </div>
    )
}
