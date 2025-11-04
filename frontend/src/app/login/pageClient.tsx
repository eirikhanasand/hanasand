'use client'
import Notify from '@/components/notify/notify'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookie } from '@/utils/cookies'
import Or from '@/utils/or'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type LoginPageProps = {
    path: string | null
    serverInternal: boolean
    serverExpired: boolean
}

export default function LoginPage({ path, serverInternal, serverExpired }: LoginPageProps) {
    const [error, setError] = useState<string | null>(null)
    const [internal, setInternal] = useState<boolean>(serverInternal)
    const [expired, setExpired] = useState<boolean>(serverExpired)
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const id = formData.get('username') as string
        const password = formData.get('password') as string

        try {
            const response = await fetch(`${config.url.api}/auth/login/${id}`, {
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
            setCookie('id', data.id, 1)
            setCookie('avatar', data.avatar, 1)
            setCookie('access_token', data.token, 1)

            if (path) {
                router.push(path)
            } else {
                router.push(`/dashboard`)
            }
        } catch (error) {
            if ('message' in (error as { message: string })) {
                try {
                    const message = (error as { message: string }).message
                    const msg = JSON.parse(message)
                    return setError(msg?.error)
                } catch (err) {
                    setError(err instanceof Error
                        ? err.message.includes('Unauthorized')
                            ? 'Unauthorized'
                            : err.message
                        : 'Unknown error! Please contact @eirikhanasand')
                }
            }

            setError(error instanceof Error
                ? error.message.includes('Unauthorized')
                    ? 'Unauthorized'
                    : error.message
                : 'Unknown error! Please contact @eirikhanasand')
        }
    }

    useClearStateAfter({ condition: error, set: setError })
    useClearStateAfter({ condition: internal, set: setInternal })
    useClearStateAfter({ condition: expired, set: setExpired, timeout: 8000 })

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id) {
            router.push('/dashboard')
        }
    }, [router])

    return (
        <section className='min-h-[93.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-[15rem] md:px-40 lg:px-100 grid gap-4 place-items-center'>
            {(expired && path) && <h1 className='grid w-full rounded-lg bg-blue-500 p-2 z-10 text-center spawn min-w-fit min-h-fit'>Token expired. You will be redirected back to {path} after reauthenticating.</h1>}
            {(internal && path) && <h1 className='grid w-full rounded-lg bg-red-500 p-2 z-10 text-center spawn min-w-fit min-h-fit'>{path} is internal. Please log in.</h1>}
            <div className='grid w-full spawn rounded-lg overflow-hidden glow-blue'>
                <div className='w-full h-full bg-light p-4 relative grid place-items-center'>
                    <h1 className='text-2xl font-light md:font-semibold text-center tracking-tight'>
                        hanasand.com
                    </h1>
                    <div className='grid place-items-center gap-4'>
                        <div className='grid gap-4 place-items-center'>
                            {error && <Notify message={error} />}
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
                                    'hover:bg-blue-500/80 cursor-pointer'
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
