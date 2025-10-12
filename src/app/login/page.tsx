'use client'
import config from '@/config'
import { setCookie } from '@/utils/cookies'
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
        setTimeout(() => {
            setError('')
        }, 5000)
    }, [error])

    return (
        <section className='grid place-items-center min-h-[93.5vh] w-full'>
            <div
                className={
                    'grid place-items-center self-center bg-light px-4 ' + 
                    'py-4 md:py-12 rounded-xl w-[80vw] md:w-full max-w-md gap-4 md:gap-6'
                }
            >
                <h1 className='text-2xl font-light md:font-semibold text-center tracking-tight'>
                    {"hanasand.com"}
                </h1>
                {error && (
                    <div className='w-full max-w-xs bg-extralight rounded-lg p-2'>
                        <h1 className='text-center'>{error}</h1>
                        <div className='h-1 bg-red-500 w-0 my-1 animate-slide-line rounded-lg' />
                    </div>
                )}
                <form
                    className='w-full flex flex-col gap-3 max-w-xs'
                    onSubmit={handleSubmit}
                >
                    <input
                        type='text'
                        name='name'
                        placeholder='Name'
                        className='py-2 px-3 rounded-lg bg-extralight font-medium focus:outline-none'
                        required
                    />
                    <input
                        type='password'
                        name='password'
                        placeholder='Password'
                        className='py-2 px-3 rounded-lg bg-extralight font-medium focus:outline-none'
                        required
                    />
                    <button
                        type='submit'
                        className={
                            'py-2 px-4 rounded-lg bg-extralight font-bold ' + 
                            'text-lg hover:bg-extralight/80 mt-2 cursor-pointer'
                        }
                    >
                        Login
                    </button>
                </form>
            </div>
        </section>
    )
}
