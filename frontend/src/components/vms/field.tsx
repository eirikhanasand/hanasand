type FieldProps = {
    title: string
    value: string
    underline?: boolean
}

export default function Field({ title, value, underline = true }: FieldProps) {
    return (
        <div className='w-full py-1'>
            <h1 className='text-xs text-[#e25822]'>{title}</h1>
            <h1 className='text-sm text-bright/80'>{value}</h1>
            {underline && <div className='w-full h-px bg-dark rounded-lg' />}
        </div>
    )
}
