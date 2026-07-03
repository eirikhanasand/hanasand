import getRequestLogs from '@/utils/traffic/getRequestLogs'
import { useState, useEffect } from 'react'

type RequestLog = {
    metric: string
    value: string | number
    path: string
    hits: number
    last_seen: string
}

export default function RecentLogs() {
    const [logs, setLogs] = useState<RequestLog[]>([])
    const [sort, setSort] = useState<'timestamp' | 'hits'>('timestamp')
    const [limit, setLimit] = useState(50)

    async function fetchLogs() {
        try {
            const response = await getRequestLogs({ limit, sort })
            setLogs(response)
        } catch (err) {
            console.error('Failed to fetch logs:', err)
        }
    }

    useEffect(() => {
        fetchLogs()

        const interval = setInterval(fetchLogs, 5000)
        return () => clearInterval(interval)
    }, [sort, limit])

    return (
        <div className='p-4 bg-ui-panel backdrop-blur-lg rounded-lg'>
            <div className='flex justify-between mb-2'>
                <h2 className='text-lg font-semibold text-ui-text'>Recent Logs</h2>
                <div className='flex gap-2'>
                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value as 'timestamp' | 'hits')}
                        className='bg-ui-raised text-ui-text px-2 rounded-lg border border-ui-border'
                    >
                        <option value='timestamp'>Sort by Timestamp</option>
                        <option value='hits'>Sort by Hits</option>
                    </select>
                    <input
                        type='number'
                        min={10}
                        max={500}
                        value={limit}
                        onChange={e => setLimit(Number(e.target.value))}
                        className='bg-ui-raised text-ui-text px-2 rounded-lg border border-ui-border w-20'
                    />
                </div>
            </div>

            <table className='w-full text-sm text-ui-text border-collapse'>
                <thead>
                    <tr>
                        <th className='border-b border-ui-border p-1'>Metric</th>
                        <th className='border-b border-ui-border p-1'>Value</th>
                        <th className='border-b border-ui-border p-1'>Path</th>
                        <th className='border-b border-ui-border p-1'>Hits</th>
                        <th className='border-b border-ui-border p-1'>Last Seen</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log, idx) => (
                        <tr key={idx} className='odd:bg-ui-raised even:bg-ui-panel'>
                            <td className='p-1'>{log.metric}</td>
                            <td className='p-1'>{log.value}</td>
                            <td className='p-1'>{log.path}</td>
                            <td className='p-1'>{log.hits}</td>
                            <td className='p-1'>{new Date(log.last_seen).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
