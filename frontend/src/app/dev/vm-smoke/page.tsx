'use client'

import RestartButtons from '@/components/vms/restartButtons'
import VMHardware from '@/components/vms/vmHardware'

const smokeVm = {
    name: 'folder/test vm',
    status: 'stopped',
} as VM

export default function VmSmokePage() {
    return (
        <main className='mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 bg-ui-canvas px-6 py-10 text-ui-text'>
            <div className='rounded-lg border border-ui-border bg-ui-panel p-6 shadow-sm'>
                <p className='text-xs uppercase tracking-[0.22em] text-ui-muted'>Dev</p>
                <h1 className='mt-2 text-2xl font-semibold text-ui-text'>VM control smoke</h1>
                <p className='mt-2 text-sm text-ui-muted'>
                    Uses a stopped VM fixture with a slash in the VM name so the start action can be regression tested.
                </p>
                <div className='mt-6 inline-flex rounded-lg border border-ui-border bg-ui-raised p-4'>
                    <RestartButtons vm={smokeVm} forceVisible />
                </div>
                <div className='mt-6'>
                    <VMHardware boxStyle='rounded-lg border border-ui-border bg-ui-raised p-4' boxTitleStyle='text-base font-medium text-ui-text' vm={smokeVm} />
                </div>
            </div>
        </main>
    )
}
