'use client'
import Link from 'next/link'
import buyHostOption, { type HostOption } from '@/utils/vms/fetch/buyHostOption'
import { useEffect, useState } from 'react'
import { containerAccessPlans } from '@/utils/commercialAccess'

type Container = { name: string, always_running_premium: boolean, failover_premium: boolean }
export default function ContainerHostPlans() {
    const [containers, setContainers] = useState<Container[]>([])
    const [selected, setSelected] = useState('')
    const [message, setMessage] = useState('')
    const [signedOut, setSignedOut] = useState(false)
    const [loading, setLoading] = useState(true)
    const [buying, setBuying] = useState('')
    useEffect(() => {
        let cancelled = false
        fetch('/api/backend/billing/container-products', { cache: 'no-store' }).then(async response => {
            if (response.status === 401) { if (!cancelled) setSignedOut(true); return }
            if (!response.ok) throw new Error('Container options could not be loaded. Please refresh.')
            const data = await response.json() as { containers: Container[] }
            if (cancelled) return
            setContainers(data.containers)
            const requested = new URLSearchParams(window.location.search).get('container')
            setSelected(data.containers.find(vm => vm.name === requested)?.name || data.containers[0]?.name || '')
        }).catch(error => { if (!cancelled) setMessage(error.message) }).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [])
    async function buy(feature: HostOption) {
        setBuying(feature); setMessage('')
        try {
            await buyHostOption(selected, feature)
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Checkout could not be opened.'); setBuying('') }
    }
    const container = containers.find(vm => vm.name === selected)
    return <section id='container-host-options' className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5' aria-label='Container host options'>
        <div><h2 className='text-xl font-semibold text-ui-text'>Container host options</h2>
            <p className='mt-1 text-sm text-ui-muted'>Monthly options for one container. Choose a container before buying.</p></div>
        {signedOut ? <Link href='/login?next=/subscription' className='text-sm font-semibold text-ui-primary'>Sign in to choose a container</Link>
            : loading ? <p className='text-sm text-ui-muted'>Loading your containers…</p>
                : containers.length ? <label className='grid max-w-sm gap-2 text-sm text-ui-text'>Container
                    <select aria-label='Container' value={selected} onChange={event => setSelected(event.target.value)} disabled={!!buying} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3'>
                        {containers.map(vm => <option key={vm.name} value={vm.name}>{vm.name}</option>)}
                    </select></label>
                    : !message ? <Link href='/vms' className='text-sm font-semibold text-ui-primary'>Create a container to add host options</Link> : null}
        <div className='grid gap-4 md:grid-cols-2'>{containerAccessPlans.map(plan => {
            const active = container?.[plan.id === 'always_running' ? 'always_running_premium' : 'failover_premium']
            return <article key={plan.id} className='grid gap-3 rounded-lg border border-ui-border p-4'>
                <h3 className='font-semibold text-ui-text'>{plan.name}</h3>
                <p className='text-sm text-ui-muted'>{plan.summary}</p>
                <p className='text-xl font-semibold text-ui-text'>{plan.priceNok} NOK <span className='text-sm font-normal text-ui-muted'>/ month per container</span></p>
                <button type='button' disabled={!selected || !!buying || active} onClick={() => buy(plan.id)}
                    className='h-10 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>
                    {active ? 'Already purchased' : buying === plan.id ? 'Opening checkout…' : 'Buy for ' + (selected || 'a container')}
                </button>
            </article>
        })}</div>
        {message ? <p role='alert' className='text-sm text-ui-warning'>{message}</p> : null}
    </section>
}
