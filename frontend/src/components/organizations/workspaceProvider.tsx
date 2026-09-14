'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, Fragment, type ReactNode } from 'react'
import BrandLogo from '@/components/brand/brandLogo'
import { Building2, LoaderCircle, TriangleAlert } from 'lucide-react'
import { hasAppSidebar } from '@/utils/routes/appRoutes'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { cleanWorkspaceUrl, organizationFromParams, type Workspace } from '@/utils/organizations/workspace'

type Organization = { id: string, name?: string, slug?: string, role?: string, lifecycleStatus?: string }
type Context = { organizationId: string, organizations: Organization[], loading: boolean, switchOrganization: (id: string) => Promise<void> }
const WorkspaceContext = createContext<Context>({ organizationId: '', organizations: [], loading: true, switchOrganization: async () => {} })
export const useWorkspace = () => useContext(WorkspaceContext)
export default function WorkspaceProvider({ initial, enabled: authenticated, children }: { initial: Workspace | null, enabled: boolean, children: ReactNode }) {
    const params = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const enabled = authenticated && hasAppSidebar(pathname || '')
    const requested = organizationFromParams(params)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [loading, setLoading] = useState(true)
    const [switching, setSwitching] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [pendingWorkspace, setPendingWorkspace] = useState<Workspace | null>(null)
    const attempted = useRef('')
    const organizationId = initial?.organizationId || ''
    const switchOrganization = useCallback(async (org: string) => {
        setSwitching(true); setError('')
        try {
            const response = await fetch('/api/workspace-organization', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org }) })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'Could not switch organization.')
            if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('hanasand-workspace'); channel.postMessage('changed'); channel.close() }
            setPendingWorkspace(payload.workspace)
            window.history.replaceState(window.history.state, '', cleanWorkspaceUrl(window.location.href))
            router.refresh()
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not switch organization.'); setSwitching(false) }
    }, [router])
    useEffect(() => {
        if (!enabled) { setLoading(false); return }
        setLoading(true)
        const controller = new AbortController()
        fetch('/api/organizations', { signal: controller.signal, cache: 'no-store' }).then(async response => {
            if (!response.ok) throw new Error('Organizations could not be loaded.')
            const payload = await response.json(); setOrganizations(payload.organizations || [])
        }).catch(cause => { if (!controller.signal.aborted) setError(cause.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [enabled])
    useEffect(() => {
        if (!enabled || !requested) return
        const key = `${pathname}:${params.toString()}`
        if (attempted.current === key) return
        attempted.current = key
        if (requested === organizationId) { window.history.replaceState(window.history.state, '', cleanWorkspaceUrl(window.location.href)); return }
        void switchOrganization(requested)
    }, [enabled, requested, pathname, params, switchOrganization, organizationId])
    useEffect(() => {
        if (pendingWorkspace && organizationId === pendingWorkspace.organizationId) {
            setSwitching(false); setPendingWorkspace(null); setNotice(`Switched to ${pendingWorkspace.name}`)
        }
    }, [pendingWorkspace, organizationId])
    useEffect(() => {
        if (!notice) return
        const timer = setTimeout(() => setNotice(''), 3000)
        return () => clearTimeout(timer)
    }, [notice])
    useEffect(() => {
        if (!enabled || switching || requested) return
        const refresh = () => { void fetch('/api/workspace-organization', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(payload => {
            if (payload && (payload.workspace?.organizationId || '') !== organizationId) { setSwitching(true); window.location.reload() }
        }).catch(() => {}) }
        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hanasand-workspace') : null
        if (channel) channel.onmessage = refresh
        window.addEventListener('focus', refresh)
        return () => { channel?.close(); window.removeEventListener('focus', refresh) }
    }, [enabled, organizationId, switching, requested])
    return <WorkspaceContext.Provider value={{ organizationId, organizations, loading, switchOrganization }}>
        {notice && <div role='status' className='fixed left-1/2 top-20 z-[1100] -translate-x-1/2 rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm text-ui-text shadow-lg'>{notice}</div>}
        {enabled && (switching || requested && requested !== organizationId) ? <main className='fixed inset-0 z-[1200] flex min-h-dvh flex-col overflow-auto bg-ui-canvas text-ui-text'>
            <header className='flex h-20 shrink-0 items-center border-b border-ui-border bg-ui-panel px-6 sm:px-10'><BrandLogo /></header>
            <div className='flex flex-1 items-center justify-center px-6 py-12'>
                <section aria-busy={!error} className='w-full max-w-md rounded-2xl border border-ui-border bg-ui-panel p-8 text-center shadow-sm sm:p-10'>
                    <div className='mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-ui-border bg-ui-canvas'>
                        {error ? <TriangleAlert aria-hidden className='h-6 w-6 text-ui-danger' /> : <Building2 aria-hidden className='h-6 w-6 text-ui-primary' />}
                    </div>
                    <h1 className='text-xl font-semibold tracking-tight'>{error ? 'Could not switch workspace' : 'Switching workspace'}</h1>
                    {error ? <><p role='alert' className='mt-3 text-sm leading-6 text-ui-muted'>{error}</p><div className='mt-7 flex flex-col gap-3'>
                        <button className='rounded-lg bg-ui-primary px-4 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2' onClick={() => void switchOrganization(requested)}>Retry</button>
                        <a className='rounded-lg border border-ui-border px-4 py-3 text-sm font-medium hover:bg-ui-canvas' href={cleanWorkspaceUrl(`${pathname}?${params}`)}>Keep current workspace</a>
                    </div></> : <><p className='mt-3 text-sm leading-6 text-ui-muted'>Loading your workspace. This should only take a moment.</p><div role='status' className='mt-7 flex items-center justify-center gap-2 text-sm text-ui-muted'><LoaderCircle aria-hidden className='h-4 w-4 animate-spin motion-reduce:animate-none' />Switching organization…</div></>}
                </section>
            </div>
        </main> : <><Fragment key={organizationId}>{children}</Fragment>{enabled && error && <div role='alert' className='fixed bottom-4 right-4 z-[1100] max-w-sm rounded-lg border border-ui-border bg-ui-panel p-3 text-sm text-ui-danger'>{error}</div>}</>}
    </WorkspaceContext.Provider>
}
export function OrganizationSwitcher() {
    const { organizationId, organizations, loading, switchOrganization } = useWorkspace()
    return <label className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text'><span className='hidden sm:inline'>Org</span>
        <select aria-label='Org' value={organizationId} disabled={loading} onChange={event => void switchOrganization(event.target.value)} className='h-10 min-w-0 max-w-20 rounded-lg border border-ui-border bg-ui-panel px-2 text-sm text-ui-text sm:max-w-48'>
            <option value=''>Personal workspace</option>
            {organizationId && !organizations.some(org => org.id === organizationId) && <option value={organizationId}>Organization unavailable</option>}
            {organizations.map(org => <option key={org.id} value={org.id} disabled={org.lifecycleStatus !== 'active'}>{org.name || org.slug || org.id}</option>)}
        </select>
    </label>
}
