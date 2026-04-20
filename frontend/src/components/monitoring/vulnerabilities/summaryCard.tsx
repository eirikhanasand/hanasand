import { Container } from 'lucide-react'

const tones = {
    blue: 'border-sky-400/15 bg-sky-500/10 text-sky-200',
    amber: 'border-amber-400/15 bg-amber-500/10 text-amber-200',
    emerald: 'border-emerald-400/15 bg-emerald-500/10 text-emerald-200',
    violet: 'border-violet-400/15 bg-violet-500/10 text-violet-200',
    rose: 'border-rose-400/15 bg-rose-500/10 text-rose-200',
    slate: 'border-login-100/10 bg-login-50/5 text-login-200',
} as const

export default function SummaryCard({
    title,
    value,
    icon: Icon,
    tone,
}: {
    title: string
    value: string
    icon: typeof Container
    tone: keyof typeof tones
}) {
    return (
        <div className='rounded-xl border border-login-100/10 bg-login-50/5 p-4'>
            <div className='flex items-center justify-between'>
                <span className='text-xs font-medium uppercase tracking-[0.18em] text-login-200'>{title}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${tones[tone]}`}>
                    <Icon className='h-4 w-4' />
                </div>
            </div>
            <div className='mt-3 text-sm font-medium text-login-50'>{value}</div>
        </div>
    )
}
