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
            className={`h-7 w-fit items-center rounded-md border border-ui-border px-2.5 text-[10px] font-medium uppercase tracking-normal text-ui-muted transition hover:bg-ui-raised hover:text-ui-text ${className}`}
        >
            <h1>{text}</h1>
        </button>
    )
}
