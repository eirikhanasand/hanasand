import type { ShareRuntimeCapability } from '@/utils/share/runtimeCapabilities'
import { ExternalLink, RotateCcw, ScrollText, ShieldCheck } from 'lucide-react'
import { Dispatch, SetStateAction } from 'react'

type DeployProps = {
    setTerminalOpen: Dispatch<SetStateAction<boolean>>
    terminalOpen: boolean
    capability: ShareRuntimeCapability
}

export default function Deploy({ setTerminalOpen, terminalOpen, capability }: DeployProps) {
    if (!capability.hasHttpSurface) {
        return null
    }

    const disabled = !capability.canDeploy
    const label = disabled ? 'Deploy unavailable' : terminalOpen ? 'Deployment open' : 'Deploy'
    const detail = disabled
        ? capability.reason
        : capability.evidence.length
            ? `Detected ${capability.evidence.slice(0, 2).join(', ')}${capability.evidence.length > 2 ? '...' : ''}.`
            : 'Hanasand will open the launch path with logs and recovery notes.'
    const stateClass = disabled
        ? 'cursor-not-allowed border-ui-border bg-ui-panel/80 text-ui-muted'
        : 'cursor-pointer border-ui-primary/35 bg-ui-panel/90 text-ui-primary hover:border-ui-primary/50 hover:bg-ui-raised'

    return (
        <button
            type='button'
            aria-label={disabled ? `Deployment unavailable: ${capability.reason}` : terminalOpen ? 'Deployment path is open' : 'Open deployment path with logs and rollback'}
            title={capability.reason}
            disabled={disabled}
            onClick={() => {
                if (!disabled) {
                    setTerminalOpen(true)
                }
            }}
            className={`
                fixed bottom-3 right-3 z-100 grid w-[min(23rem,calc(100vw-1.5rem))] select-none
                gap-2 rounded-lg border p-3 text-left
                shadow-lg backdrop-blur-md transition
                ${stateClass}
            `}
        >
            <span className='flex min-w-0 items-center justify-between gap-3'>
                <span className='min-w-0'>
                    <span className='block truncate text-sm font-semibold'>{label}</span>
                    <span className='mt-0.5 block truncate text-[11px] text-ui-muted'>{detail}</span>
                </span>
                <ExternalLink className='h-4 w-4 shrink-0 opacity-70' />
            </span>
            <span className='grid grid-cols-3 gap-1 text-[10px] text-ui-muted'>
                <span className='inline-flex min-w-0 items-center gap-1 rounded-full border border-ui-border bg-ui-raised px-2 py-1'>
                    <ShieldCheck className='h-3 w-3 shrink-0' />
                    <span className='truncate'>Health</span>
                </span>
                <span className='inline-flex min-w-0 items-center gap-1 rounded-full border border-ui-border bg-ui-raised px-2 py-1'>
                    <ScrollText className='h-3 w-3 shrink-0' />
                    <span className='truncate'>Logs</span>
                </span>
                <span className='inline-flex min-w-0 items-center gap-1 rounded-full border border-ui-border bg-ui-raised px-2 py-1'>
                    <RotateCcw className='h-3 w-3 shrink-0' />
                    <span className='truncate'>Rollback</span>
                </span>
            </span>
        </button>
    )
}
