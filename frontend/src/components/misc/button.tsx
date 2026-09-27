import Link from 'next/link'
import type { JSX } from 'react'

type ButtonProps = {
    text: string
    className?: string
    icon?: string | JSX.Element
    path?: string
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    onClick?: (_: object | string) => void
    disabled?: boolean
}

const variants = {
    primary: 'ui-button-primary',
    secondary: 'ui-button-secondary',
    outline: 'ui-button-outline',
    ghost: 'ui-button-ghost',
    danger: 'ui-button-danger'
}

export default function Button({
    text,
    className = '',
    icon,
    path,
    variant = 'primary',
    size = 'md',
    type = 'button',
    onClick,
    disabled
}: ButtonProps) {
    const classes = `ui-button ${variants[variant]} ui-button-${size} ${className}`
    const contents = <>{icon ? <span className='shrink-0' aria-hidden='true'>{icon}</span> : null}<span>{text}</span></>

    if (path) {
        return <Link href={path} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={`${classes}${disabled ? ' pointer-events-none opacity-55' : ''}`}>{contents}</Link>
    }

    return <button type={type} disabled={disabled} onClick={onClick} aria-label={text} className={classes}>{contents}</button>
}
