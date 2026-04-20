export default function DismissCountdown({
    bodyClass,
    dismissProgress,
    dismissSeconds,
    trackClass,
    barClass,
}: {
    bodyClass: string
    dismissProgress: number
    dismissSeconds: number
    trackClass: string
    barClass: string
}) {
    return (
        <div className='mt-3'>
            <div className={`flex items-center justify-between text-xs ${bodyClass}`}>
                <span>Dismisses automatically</span>
                <span>{dismissSeconds}s</span>
            </div>
            <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${trackClass}`}>
                <div
                    className={`h-full rounded-full transition-[width] duration-1000 ${barClass}`}
                    style={{ width: `${dismissProgress}%` }}
                />
            </div>
        </div>
    )
}
