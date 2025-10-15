'use client'

import { postBloom } from '@/utils/bloom/checkPassword'
import { ArrowLeft, Eye, Flower2Icon } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

export default function BloomPageClient() {
    const [password, setPassword] = useState('')
    const [didSearch, setDidSearch] = useState(false)
    const [passwordFile, setPasswordFile] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const color = password.length > 0 ? 'bg-green-500/80 cursor-pointer' : 'bg-dark cursor-not-allowed'

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        if (!password.length) {
            return
        }

        e.preventDefault()
        const result = await postBloom(password)
        if (!result) {
            return setError('Please try again later.')
        }
    }

    function clear() {
        setPassword('')
        setDidSearch(false)
        setPasswordFile(null)
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
                        {didSearch ? <Flower2Icon /> : <Eye />}
                        <h1 className='text-xl'>{didSearch ? 'Results' : 'Check password'}</h1>
                    </div>
                    {didSearch ?
                        <BloomSearch passwordFile={passwordFile} />
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
                <h1 className="flex-1 rounded-lg h-12 w-full grid place-items-center text-superlight">
                    Check if your password exists in any common breach file
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

function BloomSearch({ passwordFile }: { passwordFile: string | null }) {
    return (
        <div className='flex gap-2 cursor-pointer items-center bg-dark px-4 py-1 rounded-xl'>
            {passwordFile ? (
                <div>
                    <Eye height={15} width={15} className='stroke-gray-200' />
                    <h1>{passwordFile}</h1>
                </div>
            ) : (
                <h1>No hits found!</h1>
            )}
        </div>
    )
}
