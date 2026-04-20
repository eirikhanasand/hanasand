import type { ScanNotice } from './types'
import DismissCountdown from './dismissCountdown'
import { scanNoticeTones } from './scanNoticeTones'

export default function ScanNoticeCard({
    notice,
    dismissSeconds,
    dismissProgress,
}: {
    notice: ScanNotice
    dismissSeconds: number | null
    dismissProgress: number
}) {
    const tone = scanNoticeTones[notice.tone]
    const Icon = tone.icon

    return (
        <div className={`mt-4 rounded-xl border px-4 py-4 ${tone.shell}`}>
            <div className='flex items-start gap-4'>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${tone.badge}`}>
                    <Icon className={`h-5 w-5 ${tone.iconClass}`} />
                </div>
                <div className='min-w-0 flex-1'>
                    <div className={`text-sm font-semibold ${tone.title}`}>{notice.title}</div>
                    <div className={`mt-1 text-sm ${tone.body}`}>{notice.message}</div>
                    {dismissSeconds !== null && (
                        <DismissCountdown
                            bodyClass={tone.body}
                            dismissProgress={dismissProgress}
                            dismissSeconds={dismissSeconds}
                            trackClass={tone.track}
                            barClass={tone.bar}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
