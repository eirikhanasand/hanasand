'use client'
import config from '@/config'
import { setCookie } from '@/utils/cookies'
import Or from '@/utils/or'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LoginPage() {
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const username = formData.get('username') as string
        const password = formData.get('password') as string

        try {
            const response = await fetch(`${config.url.api}/auth/login/${username}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            })

            if (!response.ok) {
                throw new Error(await response.text())
            }

            const data = await response.json()
            setCookie('name', data.name, 1)
            setCookie('access_token', data.token, 1)
            document.location.href = `/profile`
        } catch (error) {
            if ('message' in (error as { message: string })) {
                try {
                    const message = (error as { message: string }).message
                    const msg = JSON.parse(message)
                    return setError(msg?.error)
                } catch {}
            }

            setError(error instanceof Error
                ? error.message.includes('Unauthorized')
                    ? 'Unauthorized'
                    : error.message
                : 'Unknown error! Please contact @eirikhanasand')
        }
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
        <section className='min-h-[93.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-[15rem] md:px-40 lg:px-100 grid gap-2 place-items-center'>
            <div className='grid w-full spawn rounded-lg overflow-hidden glow-blue'>
                <div className='w-full h-full bg-light p-4 relative grid place-items-center'>
                    <h1 className='text-2xl font-light md:font-semibold text-center tracking-tight'>
                        {"hanasand.com"}
                    </h1>
                    <div className='grid place-items-center gap-4'>
                        <div className='grid gap-4'>
                            {error && (
                                <div className='w-full max-w-xs bg-extralight rounded-lg p-2 mt-4'>
                                    <h1 className='text-center'>{error}</h1>
                                    <div className='h-1 bg-red-500 w-0 my-1 animate-slide-line rounded-lg glow-red' />
                                </div>
                            )}
                            <form
                                className='w-full flex flex-col gap-3 max-w-xs self-center'
                                onSubmit={handleSubmit}
                            >
                                <input
                                    type='text'
                                    name='username'
                                    placeholder='Username'
                                    className='py-2 px-3 rounded-lg bg-extralight font-medium focus:outline-none z-10'
                                    required
                                />
                                <input
                                    type='password'
                                    name='password'
                                    placeholder='Password'
                                    className='py-2 px-3 rounded-lg bg-extralight font-medium focus:outline-none z-10'
                                    required
                                />
                                <button
                                    type='submit'
                                    className={
                                        'py-1 px-3 rounded-lg bg-extralight ' +
                                        'hover:bg-blue-500/80 cursor-pointer glow-blue'
                                    }
                                >
                                    Login
                                </button>
                            </form>
                        </div>
                        <Or className='z-10' />
                        <Link href='/register' className='w-full flex flex-col gap-3 max-w-xs self-center'>
                            <button
                                type='submit'
                                className={
                                    'py-1 px-3 rounded-lg bg-extralight glow-blue ' +
                                    'text-lg hover:bg-blue-500/80 cursor-pointer'
                                }
                            >
                                Create account
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}
