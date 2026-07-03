export default function Bar({ label, value, total }: { label: string, value: number, total: number }) {
    const percentage = total ? (value / total) * 100 : 0
    return (
        <div className='flex items-center gap-4 min-w-0'>
            <div className='w-24 md:w-36 text-sm font-medium truncate text-ui-text' title={label}>{label}</div>
            <div className='flex-1 h-2 rounded-full overflow-hidden bg-ui-border'>
                <div
                    className='h-full rounded-full bg-linear-to-r from-ui-primary to-ui-warning'
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className='w-12 text-sm text-right text-ui-muted'>{value}</div>
        </div>
    )
}
