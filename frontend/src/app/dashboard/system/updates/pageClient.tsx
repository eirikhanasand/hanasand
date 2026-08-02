'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCcw, ShieldCheck } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { fetchAptUpdates, type AptUpdateStatus, type AptUpdateHistory } from '@/utils/aptUpdates/client'

export default function AptUpdatesClient() {
    const [status, setStatus] = useState<AptUpdateStatus | null>(null)
    const [history, setHistory] = useState<AptUpdateHistory[]>([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const load = useCallback(async () => {
        setLoading(true); setError('')
        try { const result = await fetchAptUpdates(); setStatus(result.status); setHistory(result.history) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load host update status.') }
        finally { setLoading(false) }
    }, [])
    useEffect(() => { void load() }, [load])

    const pending = status?.pending_updates || []
    const security = pending.filter(item => item.security)
    const regular = pending.filter(item => !item.security)
    const tone = status?.status === 'failed' || error ? 'danger' : pending.length ? 'warning' : 'success'
    return <div className='grid gap-3'>
        <DashboardPanel className='grid gap-4 p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div><p className='text-xs font-semibold uppercase text-ui-muted'>hanasand · Ubuntu 24.04</p><h2 className='mt-1 text-lg font-semibold'>Update control</h2><p className='mt-1 text-sm text-ui-muted'>APT remains responsible for repository signature verification. This policy only installs packages from the Ubuntu origin and does not trust urgency labels by themselves.</p></div>
                <button onClick={() => void load()} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold hover:border-ui-primary'><RefreshCcw className='h-4 w-4' />{loading ? 'Checking' : 'Refresh'}</button>
            </div>
            <div className='grid gap-2 sm:grid-cols-3'>
                <Summary icon={tone === 'danger' ? <AlertTriangle /> : <CheckCircle2 />} label='Host state' value={error || label(status?.status)} tone={tone} />
                <Summary icon={<ShieldCheck />} label='Pending security' value={`${security.length} package${security.length === 1 ? '' : 's'}`} tone={security.length ? 'danger' : 'success'} />
                <Summary icon={<Clock3 />} label='Pending regular' value={`${regular.length} package${regular.length === 1 ? '' : 's'}`} tone={regular.length ? 'warning' : 'success'} />
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
                <Detail label='Last check' value={formatDate(status?.checked_at)} />
                <Detail label='Last installed' value={`${formatDate(status?.last_update_at)}${status?.last_updated_packages?.length ? ` · ${status.last_updated_packages.join(', ')}` : ''}`} />
                <Detail label='Automatic policy' value='Security updates immediately; other Ubuntu updates after 72 hours.' />
                <Detail label='Verification' value={status?.policy?.repository_verification || 'Waiting for the host to report its verification policy.'} />
            </div>
            {status?.last_error ? <p className='rounded-lg border border-ui-danger bg-ui-danger/10 p-3 text-sm text-ui-danger'>{status.last_error}</p> : null}
        </DashboardPanel>
        <DashboardPanel className='grid gap-3 p-4'><h2 className='text-base font-semibold'>Pending packages</h2>{pending.length ? <div className='overflow-x-auto'><table className='w-full min-w-[620px] text-left text-sm'><thead className='text-xs uppercase text-ui-muted'><tr><th className='pb-2'>Package</th><th className='pb-2'>Candidate</th><th className='pb-2'>Class</th><th className='pb-2'>First seen</th></tr></thead><tbody>{pending.map(item => <tr key={`${item.package}-${item.version}`} className='border-t border-ui-border'><td className='py-2 font-mono'>{item.package}</td><td className='py-2 font-mono'>{item.version}</td><td className='py-2'>{item.security ? 'Ubuntu security · immediate' : 'Regular · 72h gate'}</td><td className='py-2 text-ui-muted'>{new Date(item.first_seen * 1000).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className='text-sm text-ui-muted'>No pending packages reported.</p>}</DashboardPanel>
        <DashboardPanel className='grid gap-3 p-4'><h2 className='text-base font-semibold'>Update history</h2>{history.length ? <div className='grid gap-2'>{history.map(item => <div key={item.run_id} className='grid gap-1 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm md:grid-cols-[180px_90px_minmax(0,1fr)]'><span className='text-ui-muted'>{formatDate(item.occurred_at)}</span><span className='font-semibold'>{item.status}</span><span>{item.error || (item.packages?.length ? `Installed: ${item.packages.join(', ')}` : 'Check completed; no packages installed.')}</span></div>)}</div> : <p className='text-sm text-ui-muted'>No host check-in has been persisted yet.</p>}</DashboardPanel>
    </div>
}

function Summary({ icon, label, value, tone }: { icon: ReactNode, label: string, value: string, tone: string }) { return <div className={`grid gap-1 rounded-lg border p-3 ${tone === 'danger' ? 'border-ui-danger bg-ui-danger/10 text-ui-danger' : tone === 'warning' ? 'border-ui-warning bg-ui-warning/10 text-ui-warning' : 'border-ui-success bg-ui-success/10 text-ui-success'}`}><div className='flex items-center gap-2 text-xs font-semibold uppercase'>{icon}<span>{label}</span></div><p className='wrap-break-word text-sm font-semibold'>{value}</p></div> }
function Detail({ label, value }: { label: string, value: string }) { return <div className='rounded-lg border border-ui-border bg-ui-raised p-3'><p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p><p className='mt-1 wrap-break-word text-sm'>{value}</p></div> }
function label(value?: string) { return value === 'ok' ? 'Healthy' : value === 'pending' ? 'Updates pending' : value === 'failed' ? 'Update failed' : 'Waiting for host check-in' }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString() : 'Not reported' }
