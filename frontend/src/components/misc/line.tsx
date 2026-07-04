type LineProps = {
    color?: string
    className?: string
    height?: number
    width?: number
}

export default function Line({ color, className, height, width }: LineProps) {
    return <div
        className={`${className}`}
        style={{ backgroundColor: color || 'var(--ui-border)', height, width }}
    />
}
