'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookie } from '@/utils/cookies'
import login from '@/utils/login/login'
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
            const data = await login(id, password)
            if (data) {
                setCookie('name', data.name, 1)
                setCookie('id', data.id, 1)
                setCookie('avatar', data.avatar, 1)
                setCookie('access_token', data.token, 1)

                if (path) {
                    router.push(path)
                }
            }

            if (!data) {
                setError('Please try again later.')
            }

            router.push(`/dashboard`)
        } catch (error) {
            if ('message' in (error as { message: string })) {
                try {
                    const message = (error as { message: string }).message
                    const msg = JSON.parse(message)
                    return setError(msg?.error)
                } catch (error) {
                    setError(error instanceof Error
                        ? error.message.includes('Unauthorized')
                            ? 'Unauthorized'
                            : error.message
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
        <section className='min-h-[90.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-[15rem] md:px-40 lg:px-100 grid gap-4 place-items-center'>
            {(expired && path) && <h1 className='grid w-full rounded-lg bg-blue-500 p-2 z-10 text-center spawn min-w-fit min-h-fit'>Token expired. You will be redirected back to {path} after reauthenticating.</h1>}
            {(internal && path) && <h1 className='grid w-full rounded-lg bg-red-500 p-2 z-10 text-center spawn min-w-fit min-h-fit'>{path} is internal. Please log in.</h1>}
            <div className='grid w-full spawn rounded-lg overflow-hidden bg-normal shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_8px_rgba(0,0,0,0.4)] backdrop-blur-lg'>
                <div className='w-full h-full p-4 relative grid place-items-center'>
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
                                        'hover:bg-blue-500/80 cursor-pointer'
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
                                    'py-1 px-3 rounded-lg bg-extralight ' +
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
