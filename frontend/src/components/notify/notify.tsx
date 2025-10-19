type NotifyProps = { 
    message: string
    color?: string
    fullWidth?: boolean
    className?: string
    glow?: boolean
}

export default function Notify({ message, color, fullWidth, className, glow }: NotifyProps) {
    return (
        <div className={`w-full ${fullWidth ? '' : 'max-w-xs'} ${className} bg-extralight rounded-lg px-2 py-1 ${glow ? 'glow-blue-small' : ''}`}>
            <h1 className='text-center'>{message}</h1>
            <div className={`h-1 ${color ? color : 'bg-red-500'} w-0 my-1 animate-slide-line rounded-lg`} />
        </div>
    )
}
