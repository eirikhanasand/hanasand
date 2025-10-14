'use client'

import copy from '@/utils/copy'
import { postLink } from '@/utils/links/post'
import { Copy } from 'lucide-react'
import { redirect } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

export default function LinkPageClient({ serverId, created }: { serverId?: string, created?: string }) {
    const [id, setId] = useState('')
    const [path, setPath] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [didCopy, setDidCopy] = useState<boolean | 'error'>(false)
    const isValidLink = path.includes('http') || (path.includes('.') && path.length > 2) || path.includes(':')
    const color = isValidLink ? 'bg-green-500/80 cursor-pointer' : path.length > 0 ? 'bg-red-500 cursor-not-allowed' : 'bg-dark cursor-not-allowed'
    const fullUrl = `https://hanasand.com/g/${serverId}`

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        if (!isValidLink) {
            return
        }

        e.preventDefault()
        const result = await postLink(id, path)
        if (typeof result === 'number') {
            return setError("This path is already taken.")
        }

        if (!result) {
            return setError('Please try again later.')
        }

        if (result.id) {
            redirect(`/g?created=true&id=${id}`)
        }
    }

    useEffect(() => {
        setTimeout(() => {
            setError('')
        }, 5000)
    }, [error])

    useEffect(() => {
        setTimeout(() => {
            setDidCopy(false)
        }, 350)
    }, [didCopy])

    if (created) {
        return (
            <div onClick={() => copy({ text: fullUrl, setDidCopy })} className='flex gap-2 cursor-pointer items-center bg-dark px-4 py-1 rounded-xl'>
                <Copy height={15} width={15} className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-gray-200' : 'stroke-red-500'} />
                <h1>{serverId}</h1>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className='grid gap-2'>
            {error && (
                <div className='w-full max-w-xs bg-extralight rounded-lg px-2 py-1'>
                    <h1 className='text-center'>{error}</h1>
                    <div className='h-1 bg-red-500 w-0 my-1 animate-slide-line rounded-lg' />
                </div>
            )}
            <input
                placeholder='Shortcut'
                onChange={(e) => setId(e.target.value)}
                value={id}
                className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden'
            />
            <input
                placeholder='Link'
                onChange={(e) => setPath(e.target.value)}
                value={path}
                className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden'
            />
            <button
                type="submit"
                className={`${color} w-full rounded-lg px-2 py-1 text-gray-300`}
            >
                <h1>Create</h1>
            </button>
        </form>
    )
}
