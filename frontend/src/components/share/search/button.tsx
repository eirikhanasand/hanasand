type ButtonProps = { 
    text: string
    onClick?: () => void
    className?: string
}

export default function Button({ text, onClick, className }: ButtonProps) {
    return (
        <div onClick={onClick} className={`w-fit p-[0.15rem] px-4 rounded-lg outline outline-bright/10 backdrop-blur-xs text-bright/70 ${className}`}>
            <h1>{text}</h1>
        </div>
    )
}
