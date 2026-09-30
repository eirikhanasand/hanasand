'use client'


export default function ProfileStat({ icon, label, value, dark = false }: { icon: React.ReactNode; label: string; value: string; dark?: boolean }) {
    return (
        <span className={`inline-flex min-w-0 flex-wrap items-center gap-1.5 border-l py-1 pl-2 text-xs ${dark ? 'border-ui-border text-ui-text' : 'border-ui-border text-ui-muted dark:border-ui-border dark:text-ui-muted'}`}>
            <span className={`shrink-0 ${dark ? 'text-ui-primary' : 'text-ui-primary'}`}>{icon}</span>
            <span className='shrink-0'>{label}</span>
            <span className={`min-w-0 wrap-break-word font-semibold ${dark ? 'text-ui-text' : 'text-ui-text dark:text-ui-text'}`}>{value}</span>
        </span>
    )
}
