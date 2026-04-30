type ButtonProps = {
    text: string
    onClick?: () => void
    className?: string
}

export default function Button({ text, onClick, className }: ButtonProps) {
    return (
        <button
            type='button'
            aria-label={text}
            onClick={onClick}
            className={`w-fit rounded-lg p-[0.15rem] px-4 text-bright/70 outline outline-bright/10 backdrop-blur-xs ${className}`}
        >
            <h1>{text}</h1>
        </button>
    )
}
