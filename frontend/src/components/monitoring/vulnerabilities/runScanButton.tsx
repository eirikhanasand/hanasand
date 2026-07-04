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
        ? 'cursor-wait border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
        : 'border-ui-success/30 bg-ui-success/10 text-ui-success hover:border-ui-success/35 hover:bg-ui-success/15'

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
