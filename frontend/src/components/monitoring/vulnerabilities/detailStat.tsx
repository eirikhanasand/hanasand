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
        <div className='rounded-xl border border-[#26354d] bg-[#101a29] p-3'>
            <div className='text-[11px] font-medium uppercase tracking-[0.18em] text-[#91a1b8]'>{label}</div>
            <div className={`mt-2 break-all text-sm text-[#e8eef8] ${mono ? 'font-mono' : ''}`}>{value}</div>
        </div>
    )
}
