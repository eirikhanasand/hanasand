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
        <div className='rounded-xl border border-login-100/10 bg-login-50/5 p-3'>
            <div className='text-[11px] font-medium uppercase tracking-[0.18em] text-login-200'>{label}</div>
            <div className={`mt-2 break-all text-sm text-login-50 ${mono ? 'font-mono' : ''}`}>{value}</div>
        </div>
    )
}
