import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { ReactNode } from 'react'
import type { PageClientProps, VulnerabilityPageState } from './types'
import type useExpandedImages from './useExpandedImages'
import type useScanNotice from './useScanNotice'
import type useSortedImages from './useSortedImages'
import { AlertTriangle, Clock3, Container, Radar, TerminalSquare } from 'lucide-react'
import SummaryGrid from './summaryGrid'
import ScanToolbar from './scanToolbar'
import ScanNoticeCard from './scanNoticeCard'
import ScanProgressCard from './scanProgressCard'

type Props = Pick<PageClientProps, 'runScanAction'> & Pick<VulnerabilityPageState, 'data'> & {
    isRefreshing: boolean
    notice: ReturnType<typeof useScanNotice>
    refresh: () => Promise<void>
    scanStatus: GetVulnerabilities['scanStatus']
    setPageState: React.Dispatch<React.SetStateAction<VulnerabilityPageState>>
    sorting: ReturnType<typeof useSortedImages>
    expansion: ReturnType<typeof useExpandedImages>
}

export default function VulnerabilityHeader(props: Props) {
    return (
        <header className='w-full'>
            <LiveScanner data={props.data} scanStatus={props.scanStatus} />
            <SummaryGrid data={props.data} scanStatus={props.scanStatus} />
            <ScanToolbar {...props} />
            {props.notice.scanNotice && (
                <ScanNoticeCard
                    notice={props.notice.scanNotice}
                    dismissProgress={props.notice.dismissProgress}
                    dismissSeconds={props.notice.dismissSeconds}
                />
            )}
            {props.scanStatus.isRunning && (
                <ScanProgressCard now={props.notice.now} scanStatus={props.scanStatus} />
            )}
        </header>
    )
}

function LiveScanner({ data, scanStatus }: { data: GetVulnerabilities | null, scanStatus: GetVulnerabilities['scanStatus'] }) {
    const hottestImage = [...(data?.images || [])].sort((a, b) => b.totalVulnerabilities - a.totalVulnerabilities)[0]
    const currentImage = scanStatus.currentImage || hottestImage?.image || 'scanner selecting image'
    const progress = scanStatus.totalImages
        ? `${scanStatus.completedImages}/${scanStatus.totalImages}`
        : scanStatus.targetCount ? `${scanStatus.completedImages}/${scanStatus.targetCount}` : '0/0'
    const state = scanStatus.isRunning ? 'scanning' : scanStatus.paused ? 'paused' : scanStatus.stale ? 'stale' : scanStatus.blocker || scanStatus.lastError ? 'blocked' : 'watching'
    const tone = state === 'scanning' || state === 'watching' ? 'ok' : state === 'blocked' ? 'bad' : 'watch'

    return (
        <section className='mb-3 overflow-hidden rounded-lg border border-[#22334d] bg-[#0f172a]'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#22334d] bg-[#101722] px-3 py-2.5'>
                <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-[#d8deea]'>
                    <Radar className='h-4 w-4 text-[#9db4ff]' />
                    Continuous scanner
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass(tone)}`}>{operationalStateLabel(state)}</span>
            </div>
            <div className='grid gap-2 p-3 xl:grid-cols-[minmax(0,1.25fr)_1fr_1fr]'>
                <LiveFact icon={<Container className='h-4 w-4' />} label='current image' value={currentImage} detail={`${progress} targets complete`} tone={tone} />
                <LiveFact icon={<AlertTriangle className='h-4 w-4' />} label='hottest image' value={hottestImage?.image || 'warming scanner'} detail={hottestImage ? `${hottestImage.totalVulnerabilities} findings, ${hottestImage.severity.critical} critical` : 'Rows attach as each image finishes'} tone={hottestImage?.severity.critical ? 'bad' : hottestImage?.totalVulnerabilities ? 'watch' : 'ok'} />
                <LiveFact icon={<Clock3 className='h-4 w-4' />} label='next action' value={scanStatus.paused ? 'paused' : scanStatus.nextRunAt ? shortTime(scanStatus.nextRunAt) : 'watching images'} detail={customerOperationalText(scanStatus.blockerAction || scanStatus.staleReason || scanStatus.lastError || 'Scanner is healthy and publishing findings')} tone={scanStatus.blocker || scanStatus.lastError || scanStatus.stale ? 'watch' : 'ok'} />
            </div>
            {scanStatus.logs.length ? (
                <div className='grid border-t border-[#22334d] bg-[#0b1220]'>
                    {scanStatus.logs.slice(-4).reverse().map(log => (
                        <div key={`${log.at}-${log.message}`} className='grid grid-cols-[8rem_4rem_minmax(0,1fr)] gap-3 border-b border-[#1f314a] px-3 py-1.5 text-xs last:border-b-0'>
                            <span className='font-mono text-[#8795ad]'>{shortTime(log.at)}</span>
                            <span className={log.level === 'error' ? 'font-semibold text-[#ff9b6b]' : log.level === 'warn' ? 'font-semibold text-[#f6b45f]' : 'font-semibold text-[#9db4ff]'}>{log.level}</span>
                            <span className='line-clamp-1 text-[#aab6ca]'><TerminalSquare className='mr-1 inline h-3.5 w-3.5' />{log.message}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    )
}

function LiveFact({ icon, label, value, detail, tone }: { icon: ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'watch' | 'bad' }) {
    return (
        <div className='min-w-0 rounded-md border border-[#22334d] bg-[#0b1220] p-2.5'>
            <div className={`flex items-center gap-2 ${toneText(tone)}`}>
                {icon}
                <p className='text-[10px] font-semibold uppercase'>{label}</p>
            </div>
            <p className='mt-2 line-clamp-1 text-sm font-semibold text-[#d8deea]'>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#aab6ca]'>{detail}</p>
        </div>
    )
}

function toneClass(tone: 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'border-[#285c3b] bg-[#102318] text-[#7bd39a]'
    if (tone === 'bad') return 'border-[#6d3a20] bg-[#29130b] text-[#ff9b6b]'
    return 'border-[#6f4a19] bg-[#281a0b] text-[#f6b45f]'
}

function toneText(tone: 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'text-[#7bd39a]'
    if (tone === 'bad') return 'text-[#ff9b6b]'
    return 'text-[#f6b45f]'
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'action_required') return 'reviewing'
    return value.replaceAll('_', ' ')
}

function customerOperationalText(value: string) {
    return value
        .replace(/\bblocked\b/gi, 'syncing')
        .replace(/\bblocker\b/gi, 'service issue')
        .replace(/\bneeds action\b/gi, 'reviewing')
        .replace(/\baction required\b/gi, 'reviewing')
}

function shortTime(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}
