'use client'

import Notify from '@/components/notify/notify'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { postTest } from '@/utils/test/postTest'
import { Copy } from 'lucide-react'
import { redirect } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

export default function TestPageClient({ serverId, created }: { serverId?: string, created?: string }) {
    const [path, setPath] = useState('')
    const [didCopy, setDidCopy] = useState<boolean | string>(false)
    const isValidLink =
    (path.includes('http://') && path.includes('.') && path.length >= 10)
    || (path.includes('https://') && path.includes('.') && path.length >= 11)
    const color = isValidLink ? 'bg-orange-500/80 cursor-pointer glow-orange-small' : path.length > 0 ? 'bg-red-500 cursor-not-allowed glow-red' : 'outline outline-dark cursor-not-allowed'
    const fullUrl = `${config.url.link}/${serverId}`
    const { condition: error, setCondition: setError } = useClearStateAfter()

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        if (!isValidLink) {
            return
        }

        e.preventDefault()
        const result = await postTest({ url: path })
        if (!result) {
            return setError('Please try again later.')
        }

        if (result.id) {
            redirect(`/test/${result.id}`)
        }
    }

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
            <Notify message={error} />
            <input
                className='outline outline-dark w-full rounded-md px-2 py-1 focus:outline-hidden z-10'
                placeholder='Link'
                onChange={(e) => setPath(e.target.value)}
                value={path}
                required
            />
            <button
                type='submit'
                className={`${color} w-full rounded-lg px-2 py-1 text-gray-300`}
            >
                Test
            </button>
        </form>
    )
}
