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

    const content = (
        <div className={`w-full ${fullWidth ? '' : 'max-w-xs'} ${className} ${background || 'bg-extralight'} rounded-lg px-2 py-1 ${glow ? 'glow-blue-small' : ''}`}>
            <h1 className='text-center'>{message}</h1>
            <div className={`h-1 ${color ? color : 'bg-red-500'} w-0 my-1 animate-slide-line rounded-lg`} />
        </div>
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
