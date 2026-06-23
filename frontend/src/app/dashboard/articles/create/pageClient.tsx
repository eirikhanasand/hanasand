'use client'

import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import fetchArticle from '@/utils/articles/fetchArticle'
import { postArticle } from '@/utils/articles/postArticle'
import { FilePlus2, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CreateClient() {
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [id, setId] = useState<string | null>(null)
    const [content, setContent] = useState<string>('')
    const [editing, setEditing] = useState(false)
    const router = useRouter()
    const name = (id || '').replace('.md', '')
    const text = editing ? `Creating ${name}` : 'Start writing...'

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
        <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <div className='flex items-center gap-2 text-[#3056d3]'>
                        <FilePlus2 className='h-4 w-4' />
                        <p className='text-xs font-semibold uppercase text-[#3056d3]'>Article editor</p>
                    </div>
                    <h1 className='mt-2 text-xl font-medium text-[#171a21]'>{text}</h1>
                </div>
                <button
                    type='button'
                    onClick={handleCreate}
                    className='inline-flex h-9 items-center gap-2 rounded-lg bg-[#22252d] px-3.5 text-sm font-medium text-white transition hover:bg-[#111318]'
                >
                    <Plus className='h-4 w-4' />
                    Create
                </button>
            </div>
            <ErrorNotice compact message={error as string | null} />
            <div className='grid w-full gap-4'>
                {content.length > 10 ? (
                    <div className='grid gap-2'>
                        <label className='text-sm font-medium text-[#394150]'>Article ID</label>
                        <input
                            value={id || ''}
                            placeholder='example.md'
                            onChange={(e) => setId(e.target.value.replaceAll('.md', ''))}
                            className='h-10 w-full rounded-lg border border-[#dfe5ee] bg-white px-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#9aa4b2] focus:border-[#3056d3]'
                        />
                    </div>
                ) : <></>}
                <Editor
                    editing={editing}
                    setEditing={setEditing}
                    customSaveLogic={true}
                    hideSaveButton
                    className='rounded-lg border border-[#dfe5ee] bg-white p-2 shadow-sm'
                    id={id || ''}
                    content={content.split('\n')}
                    onChange={setContent}
                />
            </div>
        </div>
    )
}
