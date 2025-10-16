'use client'

import config from '@/config'
import { postBloom } from '@/utils/bloom/checkPassword'
import randomId from '@/utils/random/randomId'
import { ArrowLeft, Eye } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

type BloomSearchProps = {
    breached: boolean
    breachCount: number | null
    password: string
}

export default function BloomPageClient() {
    const [password, setPassword] = useState('')
    const [didSearch, setDidSearch] = useState(false)
    const [breached, setBreached] = useState(false)
    const [breachCount, setBreachCount] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const color = password.length > 0 ? 'bg-green-500/80 cursor-pointer' : 'bg-dark cursor-not-allowed'

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        if (!password.length) {
            return
        }

        e.preventDefault()
        const result = await postBloom(password)
        console.log(result)
        if (!result) {
            return setError('Please try again later.')
        }

        setBreached(!result.ok)
        setBreachCount(result.count)

        setDidSearch(true)
    }

    function clear() {
        setPassword('')
        setBreached(false)
        setDidSearch(false)
    }

    useEffect(() => {
        if (!error) {
            return
        }

        const timeout = setTimeout(() => {
            setError('')
        }, 5000)

        return () => clearTimeout(timeout)
    }, [error])

    return (
        <div className='w-full h-full bg-light p-4 space-y-4 relative'>
            <div className='h-full grid place-items-center'>
                <div className='flex flex-col items-center gap-4'>
                    <div className='flex gap-2'>
                        <Eye className={didSearch ? !breached ? 'stroke-green-500' : 'stroke-red-500' : 'stroke-foreground'} />
                        <h1 className='text-xl'>{didSearch ? 'Results' : 'Check password'}</h1>
                    </div>
                    {didSearch ?
                        <BloomSearch breached={breached} breachCount={breachCount} password={password} />
                        : (
                            <form onSubmit={handleSubmit} className='grid gap-2'>
                                {error && (
                                    <div className='w-full max-w-xs bg-extralight rounded-lg px-2 py-1'>
                                        <h1 className='text-center'>{error}</h1>
                                        <div className='h-1 bg-red-500 w-0 my-1 animate-slide-line rounded-lg' />
                                    </div>
                                )}
                                <input
                                    type='password'
                                    placeholder='Password'
                                    onChange={(e) => setPassword(e.target.value)}
                                    value={password}
                                    className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden'
                                />
                                <button
                                    type="submit"
                                    className={`${color} w-full rounded-lg px-2 py-1 text-gray-300`}
                                >
                                    <h1>Check</h1>
                                </button>
                            </form>
                        )
                    }
                </div>
            </div>
            <div className="-ml-4 flex w-full absolute bottom-0 p-4">
                <div className='w-12' />
                <h1 className="flex-1 rounded-lg w-full grid place-items-center text-superlight text-center md:text-left text-sm md:text-base">
                    {didSearch ? '': 'Check if your password exists in any common breach file'}
                </h1>
                <div className='grid items-end w-12'>
                    {didSearch && <button
                        onClick={clear}
                        className="rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer"
                    >
                        <ArrowLeft />
                    </button>}
                </div>
            </div>
        </div>
    )
}

function BloomSearch({ breached, breachCount, password }: BloomSearchProps) {
    const [id, setId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [breachFiles, setBreachFiles] = useState<BreachFile[]>([])

    useEffect(() => {
        setId(randomId())
    }, [])

    useEffect(() => {
        if (!id) return

        const ws = new WebSocket(`${config.url.api_ws}/bloom/ws/${randomId()}`)

        ws.onopen = () => {
            console.log("open")
            ws.send(JSON.stringify({ password }))
            // setReconnect(false)
            // setIsConnected(true)
        }

        ws.onclose = () => {
            console.log("close")
            // setIsConnected(false)
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
            // setIsConnected(false)
        }


        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                console.log(msg)
                // if (msg.type === 'update' && msg.content !== editingContent) {
                //     setEditingContent(msg.content)
                //     setShare((prev) => prev ? { ...prev, timestamp: msg.timestamp } : prev)
                // }
            } catch (err) {
                console.error('Invalid message from server:', err)
            }
        }

        return () => {
            ws.close()
        }
    }, [id, password])

    const text = breachFiles.length === 1
        ? `The password exists in file '${breachFiles[0]}'.`
        : `The password exists in the following ${breachFiles.length} files`

    return (
        <div className='flex gap-2 cursor-pointer items-center rounded-xl'>
            {breached ? (
                <div className='grid gap-2'>
                    <div className='flex gap-2'>
                        <h1 className={breachFiles.length ? 'text-red-500' : ''}>{text}</h1>
                    </div>
                    <div className='bg-extralight rounded-lg p-2 max-h-[5rem] overflow-auto'>
                        {breachFiles.map((file) => (<h1 key={file.name}>{file.name}</h1>))}
                    </div>
                </div>
            ) : (
                <h1 className='text-green-500'>No hits found!</h1>
            )}
        </div>
    )
}
