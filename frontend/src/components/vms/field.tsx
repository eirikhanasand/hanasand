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
            <h1 className='text-xs text-ui-primary'>{title}</h1>
            <h1 className='text-sm text-ui-text'>{displayValue}</h1>
            {underline && <div className='h-px w-full rounded-lg bg-ui-border' />}
        </div>
    )
}
