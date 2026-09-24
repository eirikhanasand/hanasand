import { Check, Minus } from 'lucide-react'

export type NetworkRequestRow = { url?: string; method?: string; status?: number; failure?: string; host?: string; mimeType?: string; durationMs?: number; initiator?: string; ip?: string; asn?: string; port?: number; protocol?: string; tlsSubject?: string; tlsIssuer?: string; tlsValidFrom?: number; tlsValidTo?: number; at?: string }

export function networkRows(requests: NetworkRequestRow[], urls: string[]) {
    const rows = new Map<string, NetworkRequestRow & { observed: boolean }>()
    for (const request of requests) {
        if (!request.url) continue
        const key = `${request.method || 'GET'} ${request.url}`
        const previous = rows.get(key)
        rows.set(key, { ...previous, ...Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined && value !== null)), observed: true, ...(request.status ? { failure: request.failure } : {}) })
    }
    const observed = new Set([...rows.values()].map(row => row.url))
    for (const url of new Set(urls)) if (url && !observed.has(url)) rows.set(`extracted ${url}`, { url, observed: false })
    return [...rows.values()]
}

export default function NetworkTable({ requests, urls, complete }: { requests: NetworkRequestRow[]; urls: string[]; complete: boolean }) {
    const rows = networkRows(requests, urls)
    if (!rows.length) return <p className='text-sm text-ui-muted'>No network activity saved.</p>
    return <div className='max-h-[36rem] overflow-auto overscroll-contain rounded-md border border-ui-border'>
        <table className='w-full min-w-[52rem] border-collapse text-left text-xs'>
            <caption className='sr-only'>Network requests and extracted URLs</caption>
            <thead className='sticky top-0 bg-ui-raised text-ui-muted'><tr>{['Certificate', 'URL', 'Method', 'Status', 'IP', 'MIME', 'Time', 'Signer'].map(label => <th key={label} scope='col' className='border-b border-ui-border px-2 py-2'>{label}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={index} className='border-b border-ui-border/60 align-top'>
                <td className='p-2'>{row.tlsIssuer || row.tlsSubject ? <span title={`Certificate captured; trust validation not recorded. Subject: ${row.tlsSubject || 'Unknown'}. Issuer: ${row.tlsIssuer || 'Unknown'}.${row.tlsValidTo ? ` Expires: ${new Date(row.tlsValidTo * 1000).toISOString()}.` : ''}`}><Check className='h-4 w-4 text-ui-success' aria-label='Certificate captured' /></span> : <Minus className='h-4 w-4 text-ui-muted' aria-label='No certificate captured' />}</td>
                <td className='max-w-lg break-all p-2 font-mono'>{row.url}</td>
                <td className='p-2'>{row.observed ? row.method || 'GET' : ''}</td>
                <td className={`p-2 ${row.failure ? 'text-ui-warning' : 'text-ui-muted'}`}>{row.observed ? row.failure || row.status || 'Requested' : complete ? 'Not contacted' : 'No captured request'}</td>
                <td className='p-2 font-mono'>{row.ip}</td><td className='max-w-32 break-all p-2'>{row.mimeType}</td>
                <td className='whitespace-nowrap p-2'>{row.durationMs !== undefined ? `${Math.round(row.durationMs)}ms` : ''}</td><td className='max-w-48 wrap-break-word p-2'>{row.tlsIssuer}</td>
            </tr>)}</tbody>
        </table>
    </div>
}
