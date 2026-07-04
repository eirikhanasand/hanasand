import ErrorNotice from '@/components/error/errorNotice'

type NotifyProps = {
    message: string | boolean | null
    color?: string
    fullWidth?: boolean
    className?: string
    glow?: boolean
    background?: string
    absolute?: boolean
}

export default function Notify({ message, color, fullWidth, className, glow, background, absolute }: NotifyProps) {
    if (!message || typeof message === 'boolean') {
        return
    }

    const variant = color === 'info' || color?.includes('blue') ? 'info' : color === 'success' || color?.includes('green') ? 'success' : 'error'
    const content = (
        <ErrorNotice
            compact
            message={message}
            variant={variant}
            className={`${fullWidth ? 'w-full' : 'max-w-xs'} ${className || ''} ${background || ''} ${glow ? 'shadow-lg shadow-ui-primary/10' : ''}`}
        />
    )

    if (absolute) {
        return (
            <div className='absolute top-20 right-8 md:right-16 lg:right-32 backdrop-blur-sm'>
                {content}
            </div>
        )
    }

    return content
}
