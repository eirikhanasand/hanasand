'use client'

import Notify from '@/components/notify/notify'
import PwnedSearch from '@/components/pwned/pwnedSearch'
import ClearStateAfter from '@/hooks/clearStateAfter'
import postPwned from '@/utils/pwned/checkPassword'
import { ArrowLeft, Eye } from 'lucide-react'
import { FormEvent, useState } from 'react'

export default function PwnedPageClient() {
    const [password, setPassword] = useState('')
    const [didSearch, setDidSearch] = useState(false)
    const [breached, setBreached] = useState(false)
    const [breachCount, setBreachCount] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const color = password.length > 0 ? 'bg-green-500/80 cursor-pointer glow-green' : 'bg-dark cursor-not-allowed glow-green'

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        if (!password.length) {
            return
        }

        e.preventDefault()
        const result = await postPwned(password)
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

    ClearStateAfter({ condition: error, set: setError })

    return (
        <div className={`w-full h-full bg-light p-4 space-y-4 relative rounded-lg ${!didSearch ? 'glow-green' : breached ? 'glow-red' : 'glow-green'}`}>
            <div className='h-full grid place-items-center'>
                <div className='flex flex-col items-center gap-4'>
                    <div className='flex gap-2'>
                        <Eye className={didSearch ? !breached ? 'stroke-green-500' : 'stroke-red-500' : 'stroke-foreground'} />
                        <h1 className='text-xl'>{didSearch ? 'Results' : 'Check password'}</h1>
                    </div>
                    {didSearch ?
                        <PwnedSearch breached={breached} breachCount={breachCount} password={password} />
                        : (
                            <form onSubmit={handleSubmit} className='grid gap-2'>
                                {error && <Notify message={error} />}
                                <input
                                    type='password'
                                    placeholder='Password'
                                    onChange={(e) => setPassword(e.target.value)}
                                    value={password}
                                    required
                                    className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden z-10'
                                />
                                <button
                                    type='submit'
                                    className={`${color} w-full rounded-lg px-2 py-1 text-gray-300`}
                                >
                                    <h1>Check</h1>
                                </button>
                            </form>
                        )
                    }
                </div>
            </div>
            <div className='-ml-4 flex w-full absolute bottom-0 p-4'>
                <div className='w-12' />
                <h1 className='flex-1 rounded-lg w-full grid place-items-center text-superlight text-center md:text-left text-sm md:text-base'>
                    {didSearch ? '' : 'Check if your password exists in any common breach file'}
                </h1>
                <div className='grid items-end w-12'>
                    {didSearch && <button
                        onClick={clear}
                        className='rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'
                    >
                        <ArrowLeft />
                    </button>}
                </div>
            </div>
        </div>
    )
}
