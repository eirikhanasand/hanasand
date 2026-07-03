'use client'

import { useState } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import getBlocklist from '@/utils/traffic/getBlocklist'
import postBlocklist from '@/utils/traffic/postBlocklist'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import prettyDate from '@/utils/date/prettyDate'
import TrafficSpeedometer from '@/components/traffic/speedometer'
import useWS from '@/hooks/useWS'

type MetricSummary = {
    value: string
    hits_today: number
    hits_last_week: number
    hits_total: number
}

type RequestLog = {
    metric: 'ip' | 'user_agent' | 'path'
    value: string
    path: string
    hits: number
    last_seen: string
    created_at: string
}

type DashboardProps = {
    metrics: MetricSummary[]
    blocklist: BlocklistEntry[]
    logs: RequestLog[]
    topDomains: DomainTPS[]
    topUAs: UAMetrics[]
    topIPs: IPMetrics[]
}

export default function TrafficDashboard({
    metrics: serverMetrics,
    blocklist: serverBlocklist,
    logs: serverLogs,
    topDomains,
    topUAs,
    topIPs
}: DashboardProps) {
    const [metrics] = useState<MetricSummary[]>(Array.isArray(serverMetrics) ? serverMetrics : [])
    const [blocklist, setBlocklist] = useState<BlocklistEntry[]>(Array.isArray(serverBlocklist) ? serverBlocklist : [])
    const [logs] = useState<RequestLog[]>(Array.isArray(serverLogs) ? serverLogs : [])
    const [UAs] = useState<UAMetrics[]>(Array.isArray(topUAs) ? topUAs : [])
    const [IPs] = useState<IPMetrics[]>(Array.isArray(topIPs) ? topIPs : [])
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [editingBlock, setEditingBlock] = useState<BlocklistEntry | null>(null)
    const [form, setForm] = useState<Partial<BlocklistEntry>>({})
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const { data: domains } = useWS<DomainTPS[]>({ initialState: Array.isArray(topDomains) ? topDomains : [], path: '/tps/:id', replace: true })
    const commonListStyle = 'flex max-h-[62vh] flex-col gap-3 overflow-y-auto rounded-md border border-ui-border bg-ui-panel p-4 text-sm shadow-sm'

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        // @ts-expect-error
        const { name, value, type, checked } = e.target
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    async function handleBlockSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const data = await postBlocklist(editingBlock, form)
            if ('error' in data) {
                throw new Error(data.error)
            }

            setMessage(editingBlock ? 'Blocklist updated' : 'Blocklist entry added')
            setShowBlockModal(false)
            setEditingBlock(null)
            setForm({})
            setBlocklist(await getBlocklist())
        } catch (e) {
            console.error(e)
            setMessage('Failed to save blocklist entry')
        }
    }

    async function handleDeleteBlock(id: number) {
        if (!confirm('Delete this blocklist entry?')) {
            return
        }

        try {
            await fetch(`${config.url.cdn}/blocklist/${id}`, { method: 'DELETE' })
            setMessage('Blocklist entry deleted')
            setBlocklist(await getBlocklist())
        } catch (e) {
            console.error(e)
            setMessage('Failed to delete entry')
        }
    }

    function editBlock(entry: BlocklistEntry) {
        setEditingBlock(entry)
        setForm(entry)
        setShowBlockModal(true)
    }

    const domainsSortedByTps = [...domains].sort((a, b) => b.tps - a.tps)

    return (
        <div className='grid h-full gap-4'>
            <ErrorNotice compact variant='info' message={message as string | null} />

            {/* Metrics */}
            <div className='grid gap-3 overflow-hidden sm:grid-cols-2 md:max-h-60 xl:grid-cols-5'>
                {domainsSortedByTps.map((domain, id) => <TrafficSpeedometer
                    key={id}
                    name={domain.name}
                    tps={domain.tps} />
                )}
            </div>

            <SectionTitle title='Most requested routes' />
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                {metrics.map((m, i) => (
                    <MetricCard key={i} title={m.value} rows={[
                        ['Today', m.hits_today],
                        ['Last week', m.hits_last_week],
                        ['Total', m.hits_total],
                    ]} />
                ))}
                {!metrics.length && <EmptyState text='Route metrics update as requests hit the selected domain.' />}
            </div>

            <SectionTitle title='Top IPs' />
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                {IPs.map((ipMetric, i) => (
                    <div key={i} className='flex max-h-[62vh] flex-col gap-2 overflow-y-auto rounded-md border border-ui-border bg-ui-panel p-4 text-sm shadow-sm'>
                        <h2 className='break-all text-sm font-semibold text-ui-text'>{ipMetric.ip}</h2>
                        <span className='text-xs leading-5 text-ui-muted'>Most common user agent: {ipMetric.most_common_user_agent ?? 'metering'}</span>
                        <div className='mt-2'>
                            <h3 className='text-xs font-semibold text-ui-muted'>Requested paths</h3>
                            <ul className='mt-1 grid gap-1 text-xs text-ui-muted'>
                                {(Array.isArray(ipMetric.top_paths) ? ipMetric.top_paths : []).map((path, idx) => (
                                    <li key={idx} className='flex min-w-0 justify-between gap-2'>
                                        <span className='min-w-0 truncate'>{path.path}</span>
                                        <span className='shrink-0 text-ui-muted'>{path.hits}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
                {!IPs.length && <EmptyState text='IP activity streams here as edge requests arrive.' />}
            </div>

            <SectionTitle title='Top user agents' />
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                {UAs.map((ua, i) => (
                    <div key={i} className='flex max-h-[62vh] flex-col gap-2 overflow-y-auto rounded-md border border-ui-border bg-ui-panel p-4 text-sm shadow-sm'>
                        <h2 className='break-all text-xs font-semibold leading-5 text-ui-text'>{ua.user_agent}</h2>
                        <span className='text-xs text-ui-muted'>Most common IP: {ua.most_common_ip ?? 'metering'}</span>
                        <div className='mt-2'>
                            <h3 className='text-xs font-semibold text-ui-muted'>Requested paths</h3>
                            <ul className='mt-1 grid gap-1 text-xs text-ui-muted'>
                                {(Array.isArray(ua.top_paths) ? ua.top_paths : []).map((path, idx) => (
                                    <li key={idx} className='flex min-w-0 justify-between gap-2'>
                                        <span className='min-w-0 truncate'>{path.path}</span>
                                        <span className='shrink-0 text-ui-muted'>{path.hits}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
                {!UAs.length && <EmptyState text='User-agent activity streams here as edge requests arrive.' />}
            </div>

            <SectionTitle title='Blocklist and recent activity' />
            <div className='grid h-full gap-4 xl:grid-cols-2'>
                {/* Blocklist */}
                <div className={commonListStyle}>
                    <div className='flex items-center justify-between gap-3'>
                        <h1 className='text-sm font-semibold text-ui-text'>Access controls</h1>
                        <button
                            className='flex h-8 cursor-pointer items-center gap-1 rounded-md border border-ui-border bg-ui-raised px-2.5 text-xs font-semibold text-ui-text transition hover:border-ui-primary'
                            onClick={() => setShowBlockModal(true)}
                        >
                            <Plus className='w-4 h-4' /> Add
                        </button>
                    </div>
                    <div className='h-full overflow-x-auto'>
                        <table className='w-full min-w-[28rem] text-left text-sm'>
                            <thead>
                                <tr className='border-b border-ui-border text-xs font-semibold text-ui-muted'>
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th />
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {blocklist.map((entry, id) => (
                                    <tr key={id} className='group border-b border-ui-border text-ui-muted'>
                                        <td className='py-2'>{entry.type}</td>
                                        <td className='break-all py-2'>{entry.value}</td>
                                        {<td className='flex gap-2 w-full justify-end'>
                                            <button onClick={() => editBlock(entry)} className='hidden cursor-pointer text-ui-muted hover:text-ui-primary group-hover:block'>
                                                <Pencil className='w-4 h-4' />
                                            </button>
                                            <button onClick={() => handleDeleteBlock(entry.id)} className='hidden cursor-pointer text-ui-muted hover:text-ui-danger group-hover:block'>
                                                <X className='w-5 h-5' />
                                            </button>
                                            <div className='block group-hover:hidden w-5' />
                                            <div className='block group-hover:hidden w-5' />
                                        </td>}
                                    </tr>
                                ))}
                                {!blocklist.length && <tr><td colSpan={4} className='py-4 text-sm text-ui-muted'>Access controls are clear; add a rule when a route, IP, or user agent needs blocking.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className={commonListStyle}>
                    <h1 className='text-sm font-semibold text-ui-text'>Recent requests</h1>
                    <div className='overflow-x-auto'>
                        <table className='w-full min-w-[42rem] overflow-hidden text-left text-sm'>
                            <thead className='w-full'>
                                <tr className='border-b border-ui-border text-xs font-semibold text-ui-muted'>
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th>Path</th>
                                    <th>Hits</th>
                                    <th>Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={i} className='border-b border-ui-border text-ui-muted'>
                                        <td className='py-2'>{log.metric}</td>
                                        <td className='break-all py-2'>{log.value}</td>
                                        <td className='break-all py-2'>{log.path}</td>
                                        <td className='py-2'>{log.hits}</td>
                                        <td className='min-w-fit py-2'>{prettyDate(log.last_seen)}</td>
                                    </tr>
                                ))}
                                {!logs.length && <tr><td colSpan={5} className='py-4 text-sm text-ui-muted'>Request stream is active; rows update as traffic is observed.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Blocklist Modal */}
            {showBlockModal && (
                <div
                    onClick={() => setShowBlockModal(false)}
                    className='fixed inset-0 z-30 grid place-items-center bg-ui-canvas/80 backdrop-blur-sm'
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className='w-96 rounded-md border border-ui-border bg-ui-panel p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]'
                    >
                        <div className='mb-4 flex items-center justify-between gap-3'>
                            <h2 className='text-base font-semibold text-ui-text'>{editingBlock ? 'Edit access control' : 'Add access control'}</h2>
                            <button onClick={() => setShowBlockModal(false)} className='grid h-7 w-7 place-items-center rounded-md text-ui-muted hover:bg-ui-raised'><X className='h-4 w-4' /></button>
                        </div>
                        <form className='flex flex-col gap-3' onSubmit={handleBlockSubmit}>
                            <label className='flex flex-col gap-1.5 text-sm font-medium text-ui-muted'>
                                Metric
                                <select name='metric' value={form.type || ''} onChange={handleChange} required className='rounded-md border border-ui-border bg-ui-raised p-2 text-ui-text outline-none focus:border-ui-primary'>
                                    <option value=''>Select metric</option>
                                    <option value='ip'>IP</option>
                                    <option value='user_agent'>User Agent</option>
                                </select>
                            </label>

                            <label className='flex flex-col gap-1.5 text-sm font-medium text-ui-muted'>
                                Value
                                <input name='value' value={form.value || ''} onChange={handleChange} required className='rounded-md border border-ui-border bg-ui-raised p-2 text-ui-text outline-none focus:border-ui-primary' />
                            </label>

                            <label className='flex items-center gap-2 text-sm text-ui-muted'>
                                <input type='checkbox' name='is_vpn' checked={form.is_vpn || false} onChange={handleChange} /> VPN
                            </label>
                            <label className='flex items-center gap-2 text-sm text-ui-muted'>
                                <input type='checkbox' name='is_proxy' checked={form.is_proxy || false} onChange={handleChange} /> Proxy
                            </label>
                            <label className='flex items-center gap-2 text-sm text-ui-muted'>
                                <input type='checkbox' name='is_tor' checked={form.is_tor || false} onChange={handleChange} /> Tor
                            </label>

                            <button type='submit' className='mt-1 h-9 rounded-md bg-ui-primary px-4 text-sm font-semibold text-white transition hover:opacity-90 dark:text-ui-canvas'>
                                {editingBlock ? 'Update' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function SectionTitle({ title }: { title: string }) {
    return <h1 className='text-base font-semibold text-ui-text'>{title}</h1>
}

function MetricCard({ title, rows }: { title: string, rows: Array<[string, number]> }) {
    return (
        <div className='flex max-h-[62vh] flex-col gap-1 overflow-y-auto rounded-md border border-ui-border bg-ui-panel p-4 text-sm shadow-sm'>
            <h2 className='break-all text-sm font-semibold text-ui-text'>{title}</h2>
            {rows.map(([label, value]) => (
                <span key={label} className='text-xs text-ui-muted'>{label}: {value}</span>
            ))}
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className='rounded-md border border-dashed border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>
            {text}
        </div>
    )
}
