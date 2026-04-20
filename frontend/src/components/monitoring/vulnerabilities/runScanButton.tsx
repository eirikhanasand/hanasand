import { LoaderCircle, Play } from 'lucide-react'

export default function RunScanButton({
    disabled,
    isRunning,
    onClick,
}: {
    disabled: boolean
    isRunning: boolean
    onClick: () => void
}) {
    const className = disabled
        ? 'cursor-wait border-amber-400/20 bg-amber-500/10 text-amber-200'
        : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/30 hover:bg-emerald-500/15'

    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${className}`}
        >
            {disabled ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />}
            {isRunning ? 'Scanning…' : 'Run scan'}
        </button>
    )
}
