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
            className={`h-7 w-fit items-center rounded-md border border-bright/10 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-bright/48 transition hover:bg-bright/8 hover:text-bright/72 ${className}`}
        >
            <h1>{text}</h1>
        </button>
    )
}
