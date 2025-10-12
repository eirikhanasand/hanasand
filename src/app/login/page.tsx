'use client'
import config from '@/config'
import { setCookie } from '@/utils/cookies'
import { useState } from 'react'

export default function LoginPage() {
    const [error, setError] = useState('')
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const name = formData.get('name') as string
        const password = formData.get('password') as string

        try {
            const response = await fetch(`${config.url.api}/login`, {
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

    return (
        <main className='w-full h-full flex items-center justify-center p-8'>
            <div
                className={
                    'flex flex-col justify-center items-center bg-light px-4 py-12 rounded-xl w-full max-w-md gap-4 md:gap-6'
                }
            >
                <h1 className='text-2xl font-semibold text-center tracking-tight'>
                    {"hanasand.com"}
                </h1>
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
                            'py-2 px-4 rounded-lg bg-extralight font-bold text-lg ' +
                            'hover:bg-extralight/80 mt-2 cursor-pointer'
                        }
                    >
                        Login
                    </button>
                </form>
                <span className='text-sm mt-2'>v{config.version}</span>
            </div>
        </main>
    )
}
