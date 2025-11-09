'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import Notify from '@/components/notify/notify'
import config from '@/config'
import getMetrics from '@/utils/traffic/getMetrics'
import getBlocklist from '@/utils/traffic/getBlocklist'
import fetchLogs from '@/utils/traffic/getLogs'
import postBlocklist from '@/utils/traffic/postBlocklist'
import useClearStateAfter from '@/hooks/useClearStateAfter'

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

export default function TrafficDashboard() {
    const [metrics, setMetrics] = useState<MetricSummary[]>([])
    const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([])
    const [logs, setLogs] = useState<RequestLog[]>([])
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [editingBlock, setEditingBlock] = useState<BlocklistEntry | null>(null)
    const [form, setForm] = useState<Partial<BlocklistEntry>>({})
    const { condition: message, setCondition: setMessage } = useClearStateAfter()

    useEffect(() => {
        (async () => {
            const updatedMetrics = await getMetrics()
            setMetrics(updatedMetrics)
            const updatedBlocklist = await getBlocklist()
            setBlocklist(updatedBlocklist)
            const updatedLogs = await fetchLogs()
            setLogs(updatedLogs)
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

    console.log(blocklist)

    return (
        <div className="p-8 md:px-16 lg:px-32 grid gap-6 h-full">
            <Notify message={message} background="bg-dark" />

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col gap-1">
                        <h2 className="font-semibold">{m.value}</h2>
                        <span>Today: {m.hits_today}</span>
                        <span>Last Week: {m.hits_last_week}</span>
                        <span>Total: {m.hits_total}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-4 h-full">
                {/* Blocklist */}
                <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <h1 className="font-semibold">Blocklist</h1>
                        <button
                            className="flex items-center gap-1 px-2 py-1 bg-green-500/30 rounded-lg hover:bg-green-500/50"
                            onClick={() => setShowBlockModal(true)}
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                    <div className="overflow-y-auto max-h-[400px]">
                        {blocklist.map(entry => (
                            <div key={entry.id} className="flex justify-between items-center border-b border-white/20 py-1">
                                <div>{entry.metric}: {entry.value}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => editBlock(entry)} className="hover:text-yellow-400"><Pencil /></button>
                                    <button onClick={() => handleDeleteBlock(entry.id)} className="hover:text-red-500"><X /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col gap-2 overflow-y-auto max-h-[400px]">
                    <h1 className="font-semibold">Recent Activity</h1>
                    <table className="w-full text-left text-sm">
                        <thead>
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
                                <tr key={i} className="border-b border-white/10">
                                    <td>{log.metric}</td>
                                    <td>{log.value}</td>
                                    <td>{log.path}</td>
                                    <td>{log.hits}</td>
                                    <td>{new Date(log.last_seen).toLocaleString()}</td>
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
                                <select name="metric" value={form.metric || ''} onChange={handleChange} required className="p-2 rounded-lg bg-dark border border-white/20">
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
