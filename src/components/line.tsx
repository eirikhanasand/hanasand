type LineProps = {
    color?: string,
    className?: string,
    height?: number,
    width?: number
}

// Basic line of passed color
export default function Line({color, className, height, width}: LineProps): JSX.Element {
    return <div 
        className={`${className}`} 
        style={{backgroundColor: color || "#555", height, width}}
    />
}
