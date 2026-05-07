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
        <div className='pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4 text-bright/80'>
            <div className='pointer-events-auto w-full max-w-md'>
                {isCmdW ? (
                    <div className='rounded-lg border border-bright/10 bg-background/82 px-4 py-3 text-center text-sm font-normal text-bright/68 shadow-2xl shadow-black/20 backdrop-blur-md'>
                        <div className='flex flex-wrap justify-center gap-1'>
                            <span>You can use </span>
                            <span className='-mt-0.5 rounded bg-bright/10 px-2 py-0.5 font-mono text-xs text-bright/82'>⌥ + W</span>
                            <span> to close files.</span>
                        </div>
                        <div className={'h-1 bg-bright/5 w-0 my-1 animate-slide-line rounded-lg'} />
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
