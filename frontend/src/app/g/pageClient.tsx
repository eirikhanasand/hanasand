'use client'

import Notify from '@/components/notify/notify'
import ClearStateAfter from '@/hooks/clearStateAfter'
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
    const color = isValidLink ? 'bg-blue-500/80 cursor-pointer glow-blue' : path.length > 0 ? 'bg-red-500 cursor-not-allowed glow-red' : 'bg-dark cursor-not-allowed glow-blue'
    const fullUrl = `https://hanasand.com/g/${serverId}`

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        if (!isValidLink) {
            return
        }

        e.preventDefault()
        const result = await postLink(id, path)
        if (typeof result === 'number') {
            return setError('This path is already taken.')
        }

        if (!result) {
            return setError('Please try again later.')
        }

        if (result.id) {
            return redirect(`/g?created=true&id=${result.id}`)
        }
    }

    ClearStateAfter({ condition: error, set: setError, timeout: 5000 })

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
            {error && <Notify message={error} />}
            <input
                className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden z-10'
                placeholder='Shortcut'
                onChange={(e) => setId(e.target.value)}
                value={id}
            />
            <input
                className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden z-10'
                placeholder='Link'
                onChange={(e) => setPath(e.target.value)}
                value={path}
                required
            />
            <button
                type='submit'
                className={`${color} w-full rounded-lg px-2 py-1 text-gray-300`}
            >
                <h1>Create</h1>
            </button>
        </form>
    )
}
