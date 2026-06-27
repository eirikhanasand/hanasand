'use client'

import { useEffect, useState } from 'react'
import { getCookie, setCookie } from '@/utils/cookies/cookies'
import './toggle.css'

export default function ThemeSwitch() {
    const [theme, setTheme] = useState<'dark' | 'light'>('light')

    useEffect(() => {
        const savedTheme = normalizeTheme(getCookie('theme'))
        if (savedTheme) {
            setTheme(savedTheme)
            document.documentElement.classList.remove('dark', 'light')
            document.documentElement.classList.add(savedTheme)
            return
        }

        document.documentElement.classList.remove('dark', 'light')
        document.documentElement.classList.add(theme)
    }, [theme])

    function toggleTheme() {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setCookie('theme', newTheme)
        setTheme(newTheme)
    }

    const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

    return (
        <button
            type='button'
            className='group grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] text-[#4b5565] transition hover:bg-[#f6f8fb] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 dark:border-[#2b3647] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:focus-visible:ring-offset-[#050914]'
            aria-label={label}
            aria-pressed={theme === 'dark'}
            title={label}
            data-testid='theme-switch'
            onClick={toggleTheme}
        >
            <span className='sr-only'>{label}</span>
            <ThemeIcon />
        </button>
    )
}

function normalizeTheme(value: string | null | undefined): 'dark' | 'light' | null {
    if (value === 'dark' || value === 'light') {
        return value
    }

    return null
}

function ThemeIcon() {
    return (
        <svg
            className='theme-toggle_svg cursor-pointer'
            viewBox='0 0 100 100'
            xmlns='http://www.w3.org/2000/svg'
        >
            <mask id='theme-toggle_clip-path'>
                <rect x='0' y='0' width='100' height='100' fill='white' />
                <circle
                    className='theme-toggle_mask-circle'
                    cx='68'
                    cy='40'
                    r='18'
                />
            </mask>
            <circle
                className='theme-toggle_sun-moon'
                mask={'url(#theme-toggle_clip-path)'}
                cx='50'
                cy='50'
                r='23'
            />
            <rect
                className='theme-toggle_sun-ray'
                x='86'
                y='47'
                width='14'
                height='6'
            />
            <rect className='theme-toggle_sun-ray' y='47' width='14' height='6' />
            <rect
                className='theme-toggle_sun-ray'
                x='47'
                y='86'
                width='6'
                height='14'
            />
            <path
                className='theme-toggle_sun-ray'
                d='M75 78.2426L79.2426 74L89.1421 83.8995L84.8995 88.1421L75 78.2426Z'
            />
            <rect
                className='theme-toggle_sun-ray'
                x='84.8995'
                y='12'
                width='6'
                height='14'
                transform='rotate(45 84.8995 12)'
            />
            <rect
                className='theme-toggle_sun-ray'
                x='22.8995'
                y='74'
                width='6'
                height='14'
                transform='rotate(45 22.8995 74)'
            />
            <rect
                className='theme-toggle_sun-ray'
                x='13'
                y='16.2426'
                width='6'
                height='14'
                transform='rotate(-45 13 16.2426)'
            />
            <path className='theme-toggle_sun-ray' d='M47 0H53V14H47V0Z' />
        </svg>
    )
}
