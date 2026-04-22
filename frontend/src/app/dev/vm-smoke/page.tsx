'use client'

import RestartButtons from '@/components/vms/restartButtons'

const smokeVm = {
    name: 'folder/test vm',
    status: 'stopped',
} as VM

export default function VmSmokePage() {
    return (
        <main className='mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-10'>
            <div className='rounded-2xl border border-login-100/10 bg-login-900/55 p-6'>
                <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>Dev</p>
                <h1 className='mt-2 text-2xl font-semibold text-bright'>VM control smoke</h1>
                <p className='mt-2 text-sm text-bright/55'>
                    Uses a stopped VM fixture with a slash in the VM name so the start action can be regression tested.
                </p>
                <div className='mt-6 inline-flex rounded-2xl border border-login-100/10 bg-black/18 p-4'>
                    <RestartButtons vm={smokeVm} forceVisible />
                </div>
            </div>
        </main>
    )
}
