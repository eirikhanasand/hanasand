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
        const name = formData.get('name') as string
        const password = formData.get('password') as string

        try {
            const response = await fetch(`${config.url.api}/login`, {
                method: 'POST',
                body: JSON.stringify({ name, password })
            })

            if (!response.ok) {
                throw new Error(await response.text())
            }

            const data = await response.json()
            setCookie('name', data.name, 1)
            setCookie('access_token', data.token, 1)
            document.location.href = `/profile`
        } catch (error) {
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
        <section className='min-h-[93.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-60 md:px-100 grid gap-2 place-items-center'>
            <div className='grid w-full spawn rounded-lg overflow-hidden glow-blue'>
                <div className='w-full h-full bg-light p-4 relative grid place-items-center'>
                    <h1 className='text-2xl font-light md:font-semibold text-center tracking-tight'>
                        {"hanasand.com"}
                    </h1>
                    <div className='grid place-items-center gap-4'>
                        <div>
                            {error && (
                                <div className='w-full max-w-xs bg-extralight rounded-lg p-2'>
                                    <h1 className='text-center'>{error}</h1>
                                    <div className='h-1 bg-red-500 w-0 my-1 animate-slide-line rounded-lg' />
                                </div>
                            )}
                            <form
                                className='w-full flex flex-col gap-3 max-w-xs self-center'
                                onSubmit={handleSubmit}
                            >
                                <input
                                    type='text'
                                    name='name'
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
