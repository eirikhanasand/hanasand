type FieldProps = {
    title: string
    value: string | number | null | undefined
    underline?: boolean
}

export default function Field({ title, value, underline = true }: FieldProps) {
    const displayValue = value === null || value === undefined || String(value).trim() === ''
        ? 'Not reported'
        : String(value)

    return (
        <div className='w-full py-1'>
            <h1 className='text-xs text-[#f07d33]'>{title}</h1>
            <h1 className='text-sm text-bright/80'>{displayValue}</h1>
            {underline && <div className='w-full h-px bg-dark rounded-lg' />}
        </div>
    )
}
