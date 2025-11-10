'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import Notify from '@/components/notify/notify'
import config from '@/config'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import getLogs from '@/utils/traffic/getLogs'
import postBlocklist from '@/utils/traffic/postBlocklist'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import prettyDate from '@/utils/prettyDate'
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
    const commonListStyle = 'max-h-[62vh] gap-2 flex flex-col rounded-xl p-4 backdrop-blur-md outline outline-dark overflow-y-auto text-sm'

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
            getBlocklist()
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
            getBlocklist()
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
        <div className="grid gap-4 h-full">
            <Notify message={message} background="bg-dark" />

            {/* Metrics */}
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-hidden md:max-h-60">
                {domainsSortedByTps.map((domain, id) => <TrafficSpeedometer
                    key={id}
                    name={domain.name}
                    tps={domain.tps} />
                )}
            </div>

            <h1 className='font-semibold text-lg'>Top endpoints</h1>
            <div className="grid md:grid-cols-5 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className='max-h-[62vh] gap-1 flex flex-col rounded-xl p-4 backdrop-blur-md outline outline-dark overflow-y-auto text-sm'>
                        <h2 className="font-semibold text-bright/90">{m.value}</h2>
                        <span className='text-xs text-almostbright'>Today: {m.hits_today}</span>
                        <span className='text-xs text-almostbright'>Last Week: {m.hits_last_week}</span>
                        <span className='text-xs text-almostbright'>Total: {m.hits_total}</span>
                    </div>
                ))}
            </div>

            <h1 className='font-semibold text-lg'>Top IPs</h1>
            <div className="grid md:grid-cols-5 gap-4">
                {IPs.map((ipMetric, i) => (
                    <div
                        key={i}
                        className='max-h-[62vh] gap-1 flex flex-col rounded-xl p-4 backdrop-blur-md outline outline-dark overflow-y-auto text-sm'
                    >
                        <h2 className="font-semibold text-bright/90">{ipMetric.ip}</h2>
                        <span className='text-xs text-almostbright'>
                            Most Common User Agent: {ipMetric.most_common_user_agent ?? 'N/A'}
                        </span>
                        <div className="mt-2">
                            <h3 className='font-semibold text-xs'>Top Paths:</h3>
                            <ul className='text-xs text-almostbright list-disc list-inside'>
                                {ipMetric.top_paths.map((path, idx) => (
                                    <li key={idx}>{path.path} ({path.hits})</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            <h1 className='font-semibold text-lg'>Top user agents</h1>
            <div className="grid md:grid-cols-5 gap-4">
                {UAs.map((ua, i) => (
                    <div
                        key={i}
                        className='max-h-[62vh] gap-1 flex flex-col rounded-xl p-4 backdrop-blur-md outline outline-dark overflow-y-auto text-sm'
                    >
                        <h2 className="font-semibold text-bright/90 text-xs break-all">{ua.user_agent}</h2>
                        <span className='text-xs text-almostbright'>Most Common IP: {ua.most_common_ip ?? 'N/A'}</span>
                        <div className="mt-2">
                            <h3 className='font-semibold text-xs'>Top Paths:</h3>
                            <ul className='text-xs text-almostbright list-disc list-inside'>
                                {ua.top_paths.map((path, idx) => (
                                    <li key={idx} className='break-all text-[0.7rem]'>{path.path} ({path.hits})</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            <h1 className='hidden md:block font-semibold text-lg'>Blocklist</h1>
            <h1 className='block md:hidden font-semibold text-lg'>Blocklist & Live traffic</h1>
            <div className="grid md:grid-cols-2 gap-4 h-full">
                {/* Blocklist */}
                <div className={commonListStyle}>
                    <div className="flex justify-between items-center">
                        <h1 className="font-semibold">Blocklist</h1>
                        <button
                            className="flex items-center gap-1 px-2 py-1 bg-green-500/30 rounded-lg hover:bg-green-500/50 cursor-pointer"
                            onClick={() => setShowBlockModal(true)}
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                    <div className='h-full'>
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/20">
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th />
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {blocklist.map((entry, id) => (
                                    <tr key={id} className="border-b border-white/10 group text-bright/80">
                                        <td>{entry.type}</td>
                                        <td>{entry.value}</td>
                                        {<td className="flex gap-2 w-full justify-end">
                                            <button onClick={() => editBlock(entry)} className="hidden group-hover:block hover:text-yellow-400 cursor-pointer">
                                                <Pencil className='w-4 h-4' />
                                            </button>
                                            <button onClick={() => handleDeleteBlock(entry.id)} className="hidden group-hover:block hover:text-red-500 cursor-pointer">
                                                <X className='w-5 h-5' />
                                            </button>
                                            <div className='block group-hover:hidden w-5' />
                                            <div className='block group-hover:hidden w-5' />
                                        </td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className={commonListStyle}>
                    <h1 className="font-semibold">Recent Activity</h1>
                    <table className="w-full text-left text-sm overflow-hidden">
                        <thead className='w-full'>
                            <tr className="border-b border-white/20">
                                <th>Metric</th>
                                <th>Value</th>
                                <th>Path</th>
                                <th>Hits</th>
                                <th>Last Seen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr key={i} className="border-b border-white/10 text-bright/80">
                                    <td>{log.metric}</td>
                                    <td>{log.value}</td>
                                    <td>{log.path}</td>
                                    <td>{log.hits}</td>
                                    <td className='min-w-fit'>{prettyDate(log.last_seen)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Blocklist Modal */}
            {showBlockModal && (
                <div
                    onClick={() => setShowBlockModal(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-30"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-dark rounded-2xl p-6 w-96 border border-white/20"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-semibold">{editingBlock ? 'Edit Blocklist' : 'Add Blocklist'}</h2>
                            <button onClick={() => setShowBlockModal(false)} className="w-6 h-6 grid place-items-center hover:bg-white/10 rounded-full"><X /></button>
                        </div>
                        <form className="flex flex-col gap-3" onSubmit={handleBlockSubmit}>
                            <label className="flex flex-col text-sm">
                                Metric
                                <select name="metric" value={form.type || ''} onChange={handleChange} required className="p-2 rounded-lg bg-dark border border-white/20">
                                    <option value="">Select metric</option>
                                    <option value="ip">IP</option>
                                    <option value="user_agent">User Agent</option>
                                </select>
                            </label>

                            <label className="flex flex-col text-sm">
                                Value
                                <input name="value" value={form.value || ''} onChange={handleChange} required className="p-2 rounded-lg bg-dark border border-white/20" />
                            </label>

                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name="is_vpn" checked={form.is_vpn || false} onChange={handleChange} /> VPN
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name="is_proxy" checked={form.is_proxy || false} onChange={handleChange} /> Proxy
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name="is_tor" checked={form.is_tor || false} onChange={handleChange} /> Tor
                            </label>

                            <button type="submit" className="px-4 py-1 bg-green-500 rounded-lg hover:bg-green-600">
                                {editingBlock ? 'Update' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
