'use client'

import Editor from '@/components/editor/editor'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import fetchArticle from '@/utils/articles/fetchArticle'
import { postArticle } from '@/utils/articles/postArticle'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CreateClient() {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [id, setId] = useState<string | null>(null)
    const [content, setContent] = useState<string>('')
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const name = (id || '').replace('.md', '')
    const text = editing ? `Creating ${name}` : `Start writing...`

    async function handleCreate() {
        if (!id) {
            return setError('Please provide a name before creating the article.')
        }

        if (!content) {
            return setError('You cannot create an empty article.')
        }

        const result = await postArticle(id, content)
        if (result.status === 200) {
            router.push(`/dashboard/articles?message=${result.message}`)
        } else {
            setError(result.message)
        }
    }

    useEffect(() => {
        if (id) {
            (async() => {
                const response = await fetchArticle(id)
                if (response) {
                    setError(`The article id ${id} is already taken!`)
                }
            })()
        }
    }, [id])

    useEffect(() => {
        if (!content.length) {
            setEditing(false)
        }
    }, [content])

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
                {content.length > 10 ? (
                    <div>
                        <h1 className='font-semibold z-10'>Article ID</h1>
                        <input 
                            value={id || ''} 
                            placeholder='example.md'
                            onChange={(e) => setId(e.target.value.replaceAll('.md', ''))} 
                            className='bg-light rounded-lg p-2 mt-4 w-full glow-blue-small'
                        />
                    </div>
                ) : <></>}
                {content.length > 10 && <h1 className='font-semibold z-10'>Content</h1>}
                <Editor
                    editing={editing}
                    setEditing={setEditing}
                    customSaveLogic={true}
                    hideSaveButton
                    className='bg-light rounded-lg p-2 glow-blue-small'
                    id={id || ''}
                    content={content.split('\n')}
                    onChange={setContent}
                />
            </div>
            <div onClick={handleCreate} className='bg-light hover:bg-green-500/20 hover:outline-green-500/35 cursor-pointer py-2 px-6 flex gap-2 rounded-lg w-fit place-self-end mt-10'>
                <Plus />
                <h1 className='font-semibold'>Create</h1>
            </div>
        </div>
    )
}
