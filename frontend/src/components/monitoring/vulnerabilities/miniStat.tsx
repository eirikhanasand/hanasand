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
        <div className={`rounded-xl border border-white/10 bg-white/5 ${compact ? 'px-3 py-2' : 'p-3'}`}>
            <div className='text-[11px] font-medium uppercase tracking-[0.18em] text-white/60'>{label}</div>
            <div className={`${compact ? 'mt-1 text-sm' : 'mt-2 text-lg'} font-semibold text-white`}>{value}</div>
        </div>
    )
}
