import type { GetVulnerabilities } from '@/utils/monitoring/types'
import { Bug } from 'lucide-react'

export default function EmptyState({ scanStatus }: { scanStatus: GetVulnerabilities['scanStatus'] }) {
    const state = emptyStateCopy(scanStatus)
    return (
        <div className='w-full rounded-lg border border-ui-border bg-ui-panel px-6 py-10 text-center'>
            <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ui-raised text-ui-warning'>
                <Bug className='h-6 w-6' />
            </div>
            <h2 className='mt-4 font-semibold text-ui-text'>{state.title}</h2>
            <p className='mx-auto mt-2 max-w-2xl text-sm leading-6 text-ui-muted'>{state.message}</p>
        </div>
    )
}

function emptyStateCopy(scanStatus: GetVulnerabilities['scanStatus']) {
    if (scanStatus.blocker || scanStatus.lastError) {
        return {
            title: 'Scanner needs setup',
            message: scanStatus.blockerAction || scanStatus.blocker || scanStatus.lastError || 'The scanner reported a service issue before package findings could be stored.',
        }
    }

    if (scanStatus.paused) {
        return {
            title: 'Scanner is paused',
            message: 'Resume the vulnerability scanner from Cron Jobs when image scanning should continue.',
        }
    }

    if (scanStatus.isRunning) {
        return {
            title: 'Scan in progress',
            message: scanStatus.currentImage
                ? `Scanning ${scanStatus.currentImage}; image findings will attach here as each target completes.`
                : 'The scanner is discovering running container images and will attach findings here as targets complete.',
        }
    }

    if (scanStatus.stale) {
        return {
            title: 'Scan data is stale',
            message: scanStatus.staleReason || 'No fresh vulnerability scan has completed. Use Run scan or inspect the Cron Jobs scanner entry for the current service issue.',
        }
    }

    if (scanStatus.targetCount) {
        return {
            title: 'No findings stored yet',
            message: `The scanner discovered ${scanStatus.targetCount} running target${scanStatus.targetCount === 1 ? '' : 's'} and is storing package findings as scans complete.`,
        }
    }

    return {
        title: 'No running image targets',
        message: 'The scanner is scheduled and healthy, but no running container images are currently available to scan.',
    }
}
