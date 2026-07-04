import { Container } from 'lucide-react'

const tones = {
    blue: 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary',
    amber: 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning',
    emerald: 'border-ui-success/35 bg-ui-success/10 text-ui-success',
    violet: 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary',
    rose: 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger',
    slate: 'border-ui-border bg-ui-raised text-ui-muted',
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
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='flex items-center justify-between'>
                <span className='text-[10px] font-semibold uppercase text-ui-muted'>{title}</span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${tones[tone]}`}>
                    <Icon className='h-4 w-4' />
                </div>
            </div>
            <div className='mt-2 line-clamp-1 text-sm font-semibold text-ui-text'>{value}</div>
        </div>
    )
}
