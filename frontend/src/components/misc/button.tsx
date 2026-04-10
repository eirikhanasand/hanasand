import Link from 'next/link'
import type { JSX } from 'react'

type ButtonProps = {
    text: string
    className?: string
    icon: string | JSX.Element
    path?: string
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'warning' | 'danger' | 'success' | 'info'
    onClick?: (_: object | string) => void
    disabled?: boolean
}

const variants = {
    primary: 'bg-login/70 outline-login hover:bg-login/90',
    secondary: 'bg-login-500/70 outline-login-500 hover:bg-login-500/90',
    warning: 'bg-yellow-500/70 outline-yellow-500 hover:bg-yellow-500/90',
    danger: 'bg-red-600/70 outline-red-600 hover:bg-red-600/90',
    success: 'bg-green-600/70 outline-green-600 hover:bg-green-600/90',
    info: 'bg-blue-600/70 outline-blue-600 hover:bg-blue-600/90'
}

export default function Button({
    text,
    className,
    icon,
    path,
    variant = 'primary',
    type,
    onClick,
    disabled
}: ButtonProps) {
    const bg = variants[variant]

    if (!path) {
        return (
            <button
                type={type || 'button'}
                disabled={disabled}
                onClick={onClick}
                aria-label={text}
                className={`
                    ${bg} cursor-pointer px-4 rounded-md min-h-8 h-8 flex
                    justify-evenly items-center gap-2 select-none
                    focus:outline-none border-0 outline w-fit ${className}
                `}
            >
                <h1 className='font-bold'>{icon || ''}</h1>
                <h1 className='min-w-fit w-fit'>{text}</h1>
            </button>
        )
    }

    if (disabled) {
        return (
            <div
                className={`
                    ${bg} cursor-not-allowed px-4 rounded-md h-8 flex w-fit
                    justify-evenly items-center gap-2 select-none ${className}
                `}
            >
                <h1 className='font-bold'>{icon || ''}</h1>
                <h1 className='min-w-fit w-fit'>{text}</h1>
            </div>
        )
    }

    return (
        <Link
            href={path}
            className={`
                ${bg} cursor-pointer px-4 rounded-md h-8 flex w-fit
                justify-evenly items-center gap-2 select-none ${className}
            `}
        >
            <h1 className='font-bold'>{icon || ''}</h1>
            <h1 className='min-w-fit w-fit'>{text}</h1>
        </Link>
    )
}
