import Link from 'next/link'
import type { JSX, MouseEventHandler } from 'react'

type ButtonProps = {
    text: string
    className?: string
    icon?: string | JSX.Element
    path?: string
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    onClick?: MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    'aria-label'?: string
    'aria-expanded'?: boolean
    'aria-controls'?: string
    'aria-pressed'?: boolean
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
    disabled,
    'aria-label': ariaLabel,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    'aria-pressed': ariaPressed
}: ButtonProps) {
    const classes = `ui-button ${variants[variant]} ui-button-${size} ${className}`
    const contents = <>{icon ? <span className='shrink-0' aria-hidden='true'>{icon}</span> : null}<span>{text}</span></>

    if (path) {
        return <Link href={path} aria-label={ariaLabel} aria-disabled={disabled || undefined} aria-expanded={ariaExpanded} aria-controls={ariaControls} aria-pressed={ariaPressed} tabIndex={disabled ? -1 : undefined} className={`${classes}${disabled ? ' pointer-events-none opacity-55' : ''}`}>{contents}</Link>
    }

    return <button type={type} disabled={disabled} onClick={onClick} aria-label={ariaLabel || text} aria-expanded={ariaExpanded} aria-controls={ariaControls} aria-pressed={ariaPressed} className={classes}>{contents}</button>
}
