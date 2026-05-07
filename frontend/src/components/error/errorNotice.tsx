import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

type ErrorNoticeProps = {
    message: string | boolean | null | undefined
    title?: string
    variant?: 'error' | 'info' | 'success'
    compact?: boolean
    className?: string
    actionLabel?: string
    onAction?: () => void
    secondaryActionLabel?: string
    onSecondaryAction?: () => void
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
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
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
                <div className='min-w-0 flex-1'>
                    {title ? <p className='text-xs font-medium text-bright/86'>{title}</p> : null}
                    <p className={`${compact ? 'text-xs' : 'text-sm'} font-normal leading-5 text-bright/64`}>{message}</p>
                    {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
                        <div className='mt-2 flex flex-wrap gap-2'>
                            {actionLabel && onAction ? (
                                <button
                                    type='button'
                                    onClick={onAction}
                                    className='rounded-md border border-bright/10 bg-bright/[0.055] px-2.5 py-1 text-xs font-semibold text-bright/72 transition hover:bg-bright/10 hover:text-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f07d33]'
                                >
                                    {actionLabel}
                                </button>
                            ) : null}
                            {secondaryActionLabel && onSecondaryAction ? (
                                <button
                                    type='button'
                                    onClick={onSecondaryAction}
                                    className='rounded-md px-2.5 py-1 text-xs font-semibold text-bright/48 transition hover:bg-bright/8 hover:text-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f07d33]'
                                >
                                    {secondaryActionLabel}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
