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
        <div className='rounded-xl border border-white/10 bg-white/5 p-3'>
            <div className='text-[11px] font-medium uppercase tracking-[0.18em] text-white/60'>{label}</div>
            <div className={`mt-2 break-all text-sm text-white ${mono ? 'font-mono' : ''}`}>{value}</div>
        </div>
    )
}
