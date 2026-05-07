import type { ShareRuntimeCapability } from '@/utils/share/runtimeCapabilities'
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
    const label = disabled ? 'No deploy target' : terminalOpen ? 'Deployment terminal open' : 'Launch'
    const stateClass = disabled
        ? 'cursor-not-allowed border-bright/8 bg-black/36 text-bright/34'
        : 'cursor-pointer border-[#f07d33]/25 bg-[#f07d33]/12 text-[#ffb77c] hover:border-[#f07d33]/45 hover:bg-[#f07d33]/18 hover:text-[#ffd5b4]'

    return (
        <button
            type='button'
            aria-label={disabled ? `Deployment unavailable: ${capability.reason}` : terminalOpen ? 'Terminal open for deployment commands' : 'Open launch path with deployment commands'}
            title={capability.reason}
            disabled={disabled}
            onClick={() => {
                if (!disabled) {
                    setTerminalOpen(true)
                }
            }}
            className={`
                fixed bottom-3 right-3 z-100 inline-flex max-w-[calc(100vw-1.5rem)] select-none
                items-center justify-center rounded-full border px-3.5 py-2 text-sm
                shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-md transition
                ${stateClass}
            `}
        >
            <span className='truncate'>{label}</span>
        </button>
    )
}
