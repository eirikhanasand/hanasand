'use client'

import { useEffect, useState } from 'react'
import { getCookie, setCookie } from '@/utils/cookies'
import "./toggle.css"

export const COLOR_THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
}

export default function ThemeSwitch() {
    const [theme, setTheme] = useState<string | null>(null)

    useEffect(() => {
        const savedTheme = getCookie('theme')
        if (savedTheme) {
            setTheme(savedTheme)
            applyTheme(savedTheme, true)
        } else {
            applyTheme('dark')
        }
    }, [])

    function applyTheme(newTheme: string, force?: boolean) {
        if (theme || force) {
            const root = document.documentElement
    
            if (newTheme === 'dark') {
                root.style.setProperty('--foreground-rgb', '255, 255, 255')
                root.style.setProperty('--background-start-rgb', '24, 24, 24')
                root.style.setProperty('--background-end-rgb', '24, 24, 24')
            } else {
                root.style.setProperty('--foreground-rgb', '0, 0, 0')
                root.style.setProperty('--background-start-rgb', '24, 24, 24')
                root.style.setProperty('--background-end-rgb', '24, 24, 24')
            }
        }
    }

    function toggleTheme() {
        if (theme) {
            const newTheme = theme === 'dark' ? 'light' : 'dark'
            setCookie('theme', newTheme)
            applyTheme(newTheme)
            setTheme(newTheme)
            document.body.classList.remove(...Object.values(COLOR_THEMES))
            document.body.classList.add(theme)
        }
    }

    return (
        <div className="absolute top-10 right-10 flex items-center">
            <label htmlFor="theme-toggle" className="flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    id="theme-toggle"
                    checked={theme === 'dark'}
                    onChange={toggleTheme}
                    className="sr-only"
                />
                <ThemeIcon />
            </label>
        </div>
    )
}

function ThemeIcon() {
    return (
        <svg
            className="theme-toggle_svg"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
        >
            <mask id="theme-toggle_clip-path">
                <rect x="0" y="0" width="100" height="100" fill="white" />
                <circle
                    className="theme-toggle_mask-circle"
                    cx="68"
                    cy="40"
                    r="18"
                    fill="black"
                />
            </mask>
            <circle
                className="theme-toggle_sun-moon"
                mask={'url(#theme-toggle_clip-path)'}
                cx="50"
                cy="50"
                r="23"
            />
            <rect
                className="theme-toggle_sun-ray"
                x="86"
                y="47"
                width="14"
                height="6"
            />
            <rect className="theme-toggle_sun-ray" y="47" width="14" height="6" />
            <rect
                className="theme-toggle_sun-ray"
                x="47"
                y="86"
                width="6"
                height="14"
            />
            <path
                className="theme-toggle_sun-ray"
                d="M75 78.2426L79.2426 74L89.1421 83.8995L84.8995 88.1421L75 78.2426Z"
            />
            <rect
                className="theme-toggle_sun-ray"
                x="84.8995"
                y="12"
                width="6"
                height="14"
                transform="rotate(45 84.8995 12)"
            />
            <rect
                className="theme-toggle_sun-ray"
                x="22.8995"
                y="74"
                width="6"
                height="14"
                transform="rotate(45 22.8995 74)"
            />
            <rect
                className="theme-toggle_sun-ray"
                x="13"
                y="16.2426"
                width="6"
                height="14"
                transform="rotate(-45 13 16.2426)"
            />
            <path className="theme-toggle_sun-ray" d="M47 0H53V14H47V0Z" />
        </svg>
    )
}
