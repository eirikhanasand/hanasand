import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

type ErrorNoticeProps = {
    message: string | boolean | null | undefined
    title?: string
    variant?: 'error' | 'info' | 'success'
    compact?: boolean
    className?: string
}

const variants = {
    error: {
        icon: AlertCircle,
        accent: 'bg-[#f07d33]',
        iconTone: 'text-[#f0a17a]',
    },
    info: {
        icon: Info,
        accent: 'bg-sky-300/80',
        iconTone: 'text-sky-200/80',
    },
    success: {
        icon: CheckCircle2,
        accent: 'bg-emerald-300/80',
        iconTone: 'text-emerald-200/80',
    },
}

export default function ErrorNotice({
    message,
    title,
    variant = 'error',
    compact = false,
    className = '',
}: ErrorNoticeProps) {
    if (!message || typeof message === 'boolean') {
        return null
    }

    const tone = variants[variant]
    const Icon = tone.icon

    return (
        <div className={`relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] text-bright/76 shadow-[0_12px_34px_rgba(0,0,0,0.18)] backdrop-blur-md ${compact ? 'px-3 py-2' : 'px-3.5 py-3'} ${className}`}>
            <div className={`absolute inset-y-2 left-0 w-0.5 rounded-r ${tone.accent}`} />
            <div className='flex min-w-0 items-start gap-2.5'>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.iconTone}`} />
                <div className='min-w-0'>
                    {title ? <p className='text-xs font-medium text-bright/86'>{title}</p> : null}
                    <p className={`${compact ? 'text-xs' : 'text-sm'} font-normal leading-5 text-bright/64`}>{message}</p>
                </div>
            </div>
        </div>
    )
}
