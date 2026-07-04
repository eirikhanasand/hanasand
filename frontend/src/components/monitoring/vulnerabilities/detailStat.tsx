export default function DetailStat({
    label,
    value,
    mono = false,
}: {
    label: string
    value: string
    mono?: boolean
}) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='text-[11px] font-medium uppercase tracking-[0.18em] text-ui-muted'>{label}</div>
            <div className={`mt-2 break-all text-sm text-ui-text ${mono ? 'font-mono' : ''}`}>{value}</div>
        </div>
    )
}
