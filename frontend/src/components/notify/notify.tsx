type NotifyProps = { 
    message: string | boolean | null
    color?: string
    fullWidth?: boolean
    className?: string
    glow?: boolean
    background?: string
}

export default function Notify({ message, color, fullWidth, className, glow, background }: NotifyProps) {
    if (!message || typeof message === 'boolean') {
        return
    }

    return (
        <div className={`w-full ${fullWidth ? '' : 'max-w-xs'} ${className} ${background || 'bg-extralight'} rounded-lg px-2 py-1 ${glow ? 'glow-blue-small' : ''}`}>
            <h1 className='text-center'>{message}</h1>
            <div className={`h-1 ${color ? color : 'bg-red-500'} w-0 my-1 animate-slide-line rounded-lg`} />
        </div>
    )
}
