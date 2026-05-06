'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getLogs from '@/utils/traffic/getLogs'
import postBlocklist from '@/utils/traffic/postBlocklist'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import prettyDate from '@/utils/date/prettyDate'
import TrafficSpeedometer from '@/components/traffic/speedometer'
import useWS from '@/hooks/useWS'
import getUAs from '@/utils/traffic/getUAs'
import getIPs from '@/utils/traffic/getIPs'

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
    const [metrics, setMetrics] = useState<MetricSummary[]>(serverMetrics)
    const [blocklist, setBlocklist] = useState<BlocklistEntry[]>(serverBlocklist)
    const [logs, setLogs] = useState<RequestLog[]>(serverLogs)
    const [UAs, setUAs] = useState<UAMetrics[]>(topUAs)
    const [IPs, setIPs] = useState<IPMetrics[]>(topIPs)
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [editingBlock, setEditingBlock] = useState<BlocklistEntry | null>(null)
    const [form, setForm] = useState<Partial<BlocklistEntry>>({})
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const { data: domains } = useWS<DomainTPS[]>({ initialState: topDomains, path: '/tps/:id', replace: true })
    const commonListStyle = 'flex max-h-[62vh] flex-col gap-3 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm backdrop-blur-md'

    useEffect(() => {
        (async () => {
            const updatedMetrics = await getMetrics()
            setMetrics(updatedMetrics)
            const updatedBlocklist = await getBlocklist()
            setBlocklist(updatedBlocklist)
            const updatedLogs = await getLogs()
            setLogs(updatedLogs)
            const updatedIPs = await getIPs()
            setIPs(updatedIPs)
            const updatedUAs = await getUAs()
            setUAs(updatedUAs)
        })()
    }, [])

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
            await fetch(`${config.url.api}/blocklist/${id}`, { method: 'DELETE' })
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

            <SectionTitle title='Top endpoints' />
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                {metrics.map((m, i) => (
                    <MetricCard key={i} title={m.value} rows={[
                        ['Today', m.hits_today],
                        ['Last week', m.hits_last_week],
                        ['Total', m.hits_total],
                    ]} />
                ))}
                {!metrics.length && <EmptyState text='No endpoint metrics yet.' />}
            </div>

            <SectionTitle title='Top IPs' />
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                {IPs.map((ipMetric, i) => (
                    <div key={i} className='flex max-h-[62vh] flex-col gap-2 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm backdrop-blur-md'>
                        <h2 className='break-all text-sm font-medium text-bright/82'>{ipMetric.ip}</h2>
                        <span className='text-xs leading-5 text-bright/45'>Most common user agent: {ipMetric.most_common_user_agent ?? 'N/A'}</span>
                        <div className='mt-2'>
                            <h3 className='text-xs font-medium text-bright/58'>Top paths</h3>
                            <ul className='mt-1 grid gap-1 text-xs text-bright/48'>
                                {ipMetric.top_paths.map((path, idx) => (
                                    <li key={idx} className='flex min-w-0 justify-between gap-2'>
                                        <span className='min-w-0 truncate'>{path.path}</span>
                                        <span className='shrink-0 text-bright/36'>{path.hits}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
                {!IPs.length && <EmptyState text='No IP metrics yet.' />}
            </div>

            <SectionTitle title='Top user agents' />
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                {UAs.map((ua, i) => (
                    <div key={i} className='flex max-h-[62vh] flex-col gap-2 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm backdrop-blur-md'>
                        <h2 className='break-all text-xs font-medium leading-5 text-bright/78'>{ua.user_agent}</h2>
                        <span className='text-xs text-bright/45'>Most common IP: {ua.most_common_ip ?? 'N/A'}</span>
                        <div className='mt-2'>
                            <h3 className='text-xs font-medium text-bright/58'>Top paths</h3>
                            <ul className='mt-1 grid gap-1 text-xs text-bright/48'>
                                {ua.top_paths.map((path, idx) => (
                                    <li key={idx} className='flex min-w-0 justify-between gap-2'>
                                        <span className='min-w-0 truncate'>{path.path}</span>
                                        <span className='shrink-0 text-bright/36'>{path.hits}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
                {!UAs.length && <EmptyState text='No user agent metrics yet.' />}
            </div>

            <SectionTitle title='Blocklist and recent activity' />
            <div className='grid h-full gap-4 xl:grid-cols-2'>
                {/* Blocklist */}
                <div className={commonListStyle}>
                    <div className='flex items-center justify-between gap-3'>
                        <h1 className='text-sm font-medium text-bright/88'>Blocklist</h1>
                        <button
                            className='flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-emerald-300/15 bg-emerald-300/10 px-2.5 text-xs font-medium text-emerald-100/78 transition hover:bg-emerald-300/15'
                            onClick={() => setShowBlockModal(true)}
                        >
                            <Plus className='w-4 h-4' /> Add
                        </button>
                    </div>
                    <div className='h-full overflow-x-auto'>
                        <table className='w-full min-w-[28rem] text-left text-sm'>
                            <thead>
                                <tr className='border-b border-white/10 text-xs font-medium text-bright/42'>
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th />
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {blocklist.map((entry, id) => (
                                    <tr key={id} className='group border-b border-white/8 text-bright/64'>
                                        <td className='py-2'>{entry.type}</td>
                                        <td className='break-all py-2'>{entry.value}</td>
                                        {<td className='flex gap-2 w-full justify-end'>
                                            <button onClick={() => editBlock(entry)} className='hidden cursor-pointer text-bright/42 hover:text-yellow-300 group-hover:block'>
                                                <Pencil className='w-4 h-4' />
                                            </button>
                                            <button onClick={() => handleDeleteBlock(entry.id)} className='hidden cursor-pointer text-bright/42 hover:text-red-300 group-hover:block'>
                                                <X className='w-5 h-5' />
                                            </button>
                                            <div className='block group-hover:hidden w-5' />
                                            <div className='block group-hover:hidden w-5' />
                                        </td>}
                                    </tr>
                                ))}
                                {!blocklist.length && <tr><td colSpan={4} className='py-4 text-sm text-bright/42'>No blocklist entries yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className={commonListStyle}>
                    <h1 className='text-sm font-medium text-bright/88'>Recent activity</h1>
                    <div className='overflow-x-auto'>
                        <table className='w-full min-w-[42rem] overflow-hidden text-left text-sm'>
                            <thead className='w-full'>
                                <tr className='border-b border-white/10 text-xs font-medium text-bright/42'>
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th>Path</th>
                                    <th>Hits</th>
                                    <th>Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={i} className='border-b border-white/8 text-bright/62'>
                                        <td className='py-2'>{log.metric}</td>
                                        <td className='break-all py-2'>{log.value}</td>
                                        <td className='break-all py-2'>{log.path}</td>
                                        <td className='py-2'>{log.hits}</td>
                                        <td className='min-w-fit py-2'>{prettyDate(log.last_seen)}</td>
                                    </tr>
                                ))}
                                {!logs.length && <tr><td colSpan={5} className='py-4 text-sm text-bright/42'>No recent activity yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Blocklist Modal */}
            {showBlockModal && (
                <div
                    onClick={() => setShowBlockModal(false)}
                    className='fixed inset-0 z-30 grid place-items-center bg-black/60 backdrop-blur-sm'
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className='w-96 rounded-lg border border-white/12 bg-[#111411] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)]'
                    >
                        <div className='mb-4 flex items-center justify-between gap-3'>
                            <h2 className='text-base font-medium text-bright/90'>{editingBlock ? 'Edit blocklist' : 'Add blocklist'}</h2>
                            <button onClick={() => setShowBlockModal(false)} className='grid h-7 w-7 place-items-center rounded-lg text-bright/52 hover:bg-white/10'><X className='h-4 w-4' /></button>
                        </div>
                        <form className='flex flex-col gap-3' onSubmit={handleBlockSubmit}>
                            <label className='flex flex-col gap-1.5 text-sm text-bright/60'>
                                Metric
                                <select name='metric' value={form.type || ''} onChange={handleChange} required className='rounded-lg border border-white/10 bg-black/18 p-2 text-bright outline-none focus:border-[#f07d33]/55'>
                                    <option value=''>Select metric</option>
                                    <option value='ip'>IP</option>
                                    <option value='user_agent'>User Agent</option>
                                </select>
                            </label>

                            <label className='flex flex-col gap-1.5 text-sm text-bright/60'>
                                Value
                                <input name='value' value={form.value || ''} onChange={handleChange} required className='rounded-lg border border-white/10 bg-black/18 p-2 text-bright outline-none focus:border-[#f07d33]/55' />
                            </label>

                            <label className='flex items-center gap-2 text-sm text-bright/62'>
                                <input type='checkbox' name='is_vpn' checked={form.is_vpn || false} onChange={handleChange} /> VPN
                            </label>
                            <label className='flex items-center gap-2 text-sm text-bright/62'>
                                <input type='checkbox' name='is_proxy' checked={form.is_proxy || false} onChange={handleChange} /> Proxy
                            </label>
                            <label className='flex items-center gap-2 text-sm text-bright/62'>
                                <input type='checkbox' name='is_tor' checked={form.is_tor || false} onChange={handleChange} /> Tor
                            </label>

                            <button type='submit' className='mt-1 h-9 rounded-lg bg-bright/88 px-4 text-sm font-medium text-background/90 transition hover:bg-bright'>
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
    return <h1 className='text-base font-medium text-bright/88'>{title}</h1>
}

function MetricCard({ title, rows }: { title: string, rows: Array<[string, number]> }) {
    return (
        <div className='flex max-h-[62vh] flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm backdrop-blur-md'>
            <h2 className='break-all text-sm font-medium text-bright/82'>{title}</h2>
            {rows.map(([label, value]) => (
                <span key={label} className='text-xs text-bright/45'>{label}: {value}</span>
            ))}
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className='rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-bright/42'>
            {text}
        </div>
    )
}
