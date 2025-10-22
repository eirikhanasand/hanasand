'use client'
import Notify from '@/components/notify/notify'
import config from '@/config'
import { setCookie } from '@/utils/cookies'
import Or from '@/utils/or'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type RegisterPageProps = {
    path: string | null
    serverInternal: boolean
    noroot: boolean
}

export default function RegisterPageClient({ path, serverInternal, noroot }: RegisterPageProps) {
    const [error, setError] = useState('')
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [internal, setInternal] = useState<boolean>(serverInternal)
    const [numbersInPasswordCount, setNumbersInPasswordCount] = useState(0)
    const [lowerCaseInPasswordCount, setLowercaseInPasswordCount] = useState(0)
    const [upperCaseInPasswordCount, setUppercaseInPasswordCount] = useState(0)
    const [specialCharactersInPasswordCount, setCharactersInPasswordCount] = useState(0)
    const passwordIsValid = 
        password.length >= 16 
        && numbersInPasswordCount >= 2 
        && specialCharactersInPasswordCount >= 2
        && lowerCaseInPasswordCount >= 2
        && upperCaseInPasswordCount >= 2
    const lengthColor = password.length > 0 ? password.length >= 16 ? 'text-green-500' : 'text-red-500' : '' 
    const numberColor = password.length > 0 ? numbersInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const lowerCaseColor = password.length > 0 ? lowerCaseInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const upperCaseColor = password.length > 0 ? upperCaseInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const specialCharacterColor = password.length > 0 ? specialCharactersInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : '' 

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!passwordIsValid) {
            return setError('Invalid password. Check the requirements.')
        }

        const formData = new FormData(e.currentTarget)
        const name = formData.get('name') as string
        const id = formData.get('username') as string
        const password = formData.get('password') as string

        try {
            const response = await fetch(`${config.url.api}/user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, id, password })
            })

            if (!response.ok) {
                throw new Error(await response.text())
            }

            const data = await response.json()
            if ('error' in data) {
                return setError(data.error)
            }

            setCookie('name', data.name, 1)
            setCookie('id', data.id, 1)
            setCookie('avatar', data.avatar, 1)
            setCookie('access_token', data.token, 1)
            window.location.href = `/dashboard`
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

    useEffect(() => {
        if (!error) {
            return
        }

        const timeout = setTimeout(() => {
            setError('')
        }, 5000)

        return () => clearTimeout(timeout)
    }, [error])

    useEffect(() => {
        let numbers = 0
        let specialCharacters = 0
        let lowerCaseCharacters = 0
        let upperCaseCharacters = 0
        for (const char of password) {
            if (!isNaN(Number(char))) {
                numbers++
            }

            if (/[^a-zA-Z0-9]/.test(char)) {
                specialCharacters++
            }

            if (/[a-z]/.test(char)) {
                lowerCaseCharacters++
            }

            if (/[A-Z]/.test(char)) {
                upperCaseCharacters++
            }
        }

        setNumbersInPasswordCount(numbers)
        setCharactersInPasswordCount(specialCharacters)
        setLowercaseInPasswordCount(lowerCaseCharacters)
        setUppercaseInPasswordCount(upperCaseCharacters)
    }, [password])

    useEffect(() => {
        if (internal) {
            setTimeout(() => {
                setInternal(false)
            }, 5000)
        }
    }, [internal])

    return (
        <section className='min-h-[93.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-53 md:px-40 lg:px-100 grid gap-2 place-items-center'>
            {(internal && path) && <h1 className='grid w-full rounded-lg bg-red-500 p-2 z-10 text-center spawn min-w-fit min-h-fit'>
                {path} is internal. Please log in.
            </h1>}
            {(internal && path) && <h1 className='grid w-full rounded-lg bg-red-500 p-2 z-10 text-center spawn min-w-fit min-h-fit'>
                {path} is internal. Please log in.
            </h1>}
            <div className='grid w-full spawn rounded-lg overflow-hidden glow-blue'>
                <div className='w-full h-full bg-light p-4 relative grid place-items-center'>
                    <h1 className='text-2xl font-light md:font-semibold text-center tracking-tight'>
                        hanasand.com
                    </h1>
                    <div className='grid place-items-center gap-4'>
                        <div className='grid gap-4 max-w-xs'>
                            {error && <Notify message={error} />}
                            <form
                                className='w-full flex flex-col gap-3 self-center'
                                onSubmit={handleSubmit}
                            >
                                <input
                                    type='text'
                                    name='username'
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder='Username'
                                    className='py-2 px-3 rounded-lg bg-extralight font-medium focus:outline-none z-10'
                                    required
                                />
                                <input
                                    type='text'
                                    name='name'
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder='Name'
                                    className='py-2 px-3 rounded-lg bg-extralight font-medium focus:outline-none z-10'
                                    required
                                />
                                <input
                                    type='password'
                                    name='password'
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder='Password'
                                    className='py-2 px-3 rounded-lg bg-extralight font-medium focus:outline-none z-10'
                                    required
                                />
                                {!passwordIsValid && <div className='flex text-sm text-center z-10'>
                                    <h1>
                                        The password must be at 
                                        least <span className={`font-bold ${lengthColor}`}>16
                                        </span> characters, contain at least <span className={`font-bold ${lowerCaseColor}`}>2
                                        </span> lowercase letters, <span className={`font-bold ${upperCaseColor}`}>2
                                        </span> uppercase letters, <span className={`font-bold ${numberColor}`}>2
                                        </span> numbers, 
                                        and <span className={`font-bold ${specialCharacterColor}`}>2
                                        </span> special characters.
                                    </h1>
                                </div>}
                                <button
                                    type='submit'
                                    className={
                                        'py-2 px-4 rounded-lg ' + 
                                        `${passwordIsValid ? 'cursor-pointer bg-extralight glow-blue hover:bg-blue-500/80' 
                                            : `${(!password.length && !username.length && !name.length) ? 'glow-blue' : 'glow-red'} 
                                            cursor-not-allowed bg-dark hover:bg-red-500/80`}`
                                    }
                                >
                                    Create account
                                </button>
                            </form>
                        </div>
                        <Or className='z-10' />
                        <Link href='/login' className='w-full flex flex-col gap-3 max-w-xs self-center'>
                            <button
                                type='submit'
                                className={
                                    'py-2 px-4 rounded-lg bg-extralight glow-blue ' + 
                                    'hover:bg-blue-500/80 cursor-pointer'
                                }
                            >
                                Login
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}
