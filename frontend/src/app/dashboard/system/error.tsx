'use client'

export default function SystemError({ reset }: { reset: () => void }) {
    return <section role='alert' className='rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text'>
        <p className='text-sm text-ui-muted'>System telemetry is unavailable.</p>
        <button type='button' onClick={reset} className='mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>Retry</button>
    </section>
}
