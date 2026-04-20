export default function Bar({ label, value, total }: { label: string, value: number, total: number }) {
    const percentage = total ? (value / total) * 100 : 0
    return (
        <div className='flex items-center gap-4 min-w-0'>
            <div className='w-24 md:w-36 text-sm font-medium truncate' title={label}>{label}</div>
            <div className='flex-1 h-2 bg-login-50/5 rounded-full overflow-hidden'>
                <div
                    className='h-full bg-blue-500 rounded-full'
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className='w-12 text-sm text-right text-muted-foreground'>{value}</div>
        </div>
    )
}
