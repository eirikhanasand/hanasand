import ErrorNotice from '@/components/error/errorNotice'

type DisplayErrorProps = {
    error: string | boolean | null
    onRetry?: () => void
    onDismiss?: () => void
}

export default function DisplayError({ error, onRetry, onDismiss }: DisplayErrorProps) {
    if (!error) {
        return null
    }

    const isCmdW = error === 'cmdw'
    const canRetry = typeof error === 'string' && /(failed|unable|could not|error|reconnecting|unavailable)/i.test(error)

    return (
        <div className='pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4 text-ui-text'>
            <div className='pointer-events-auto w-full max-w-md'>
                {isCmdW ? (
                    <div className='rounded-lg border border-ui-border bg-ui-panel/90 px-4 py-3 text-center text-sm font-normal text-ui-muted shadow-lg shadow-ui-canvas/10 backdrop-blur-md'>
                        <div className='flex flex-wrap justify-center gap-1'>
                            <span>You can use </span>
                            <span className='-mt-0.5 rounded bg-ui-raised px-2 py-0.5 font-mono text-xs text-ui-text'>⌥ + W</span>
                            <span> to close files.</span>
                        </div>
                        <div className='my-1 h-1 w-0 animate-slide-line rounded-lg bg-ui-border' />
                    </div>
                ) : (
                    <ErrorNotice
                        message={error}
                        title='Workspace notice'
                        actionLabel={canRetry && onRetry ? 'Retry' : undefined}
                        onAction={canRetry ? onRetry : undefined}
                        secondaryActionLabel={onDismiss ? 'Dismiss' : undefined}
                        onSecondaryAction={onDismiss}
                    />
                )}
            </div>
        </div>
    )
}
