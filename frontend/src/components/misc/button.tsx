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
    primary: 'border-ui-primary bg-ui-primary text-ui-canvas hover:opacity-90',
    secondary: 'border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary',
    warning: 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning hover:bg-ui-warning/15',
    danger: 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger hover:bg-ui-danger/15',
    success: 'border-ui-success/35 bg-ui-success/10 text-ui-success hover:bg-ui-success/15',
    info: 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15'
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
                    ${bg} cursor-pointer px-4 rounded-lg min-h-8 h-8 flex
                    justify-evenly items-center gap-2 select-none
                    border outline-none focus:ring-2 focus:ring-ui-primary/20 w-fit disabled:cursor-not-allowed disabled:opacity-55 ${className}
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
                    ${bg} cursor-not-allowed px-4 rounded-lg h-8 flex w-fit
                    justify-evenly items-center gap-2 select-none border opacity-55 ${className}
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
                ${bg} cursor-pointer px-4 rounded-lg h-8 flex w-fit
                justify-evenly items-center gap-2 select-none border transition focus:outline-none focus:ring-2 focus:ring-ui-primary/20 ${className}
            `}
        >
            <h1 className='font-bold'>{icon || ''}</h1>
            <h1 className='min-w-fit w-fit'>{text}</h1>
        </Link>
    )
}
