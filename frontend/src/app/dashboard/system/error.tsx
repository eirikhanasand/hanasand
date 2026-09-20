'use client'

export default function SystemError({ reset }: { reset: () => void }) {
    return <section role='alert' className='rounded-xl border border-ui-border bg-ui-panel p-5'>
        <p>System telemetry is unavailable.</p>
        <button type='button' onClick={reset} className='mt-3 rounded-md border border-ui-border px-3 py-2'>Retry</button>
    </section>
}
