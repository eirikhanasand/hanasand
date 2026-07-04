export default function MiniStat({
    label,
    value,
    compact = false,
}: {
    label: string
    value: string
    compact?: boolean
}) {
    return (
        <div className={`rounded-lg border border-ui-border bg-ui-panel ${compact ? 'px-3 py-2' : 'p-3'}`}>
            <div className='text-[11px] font-medium uppercase tracking-[0.18em] text-ui-muted'>{label}</div>
            <div className={`${compact ? 'mt-1 text-sm' : 'mt-2 text-lg'} font-semibold text-ui-text`}>{value}</div>
        </div>
    )
}
