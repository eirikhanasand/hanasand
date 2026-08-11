'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Ticket = { id: string; subject: string; status: string; last_message?: string; updated_at: string }

export default function SupportTickets() {
    const [tickets, setTickets] = useState<Ticket[]>([])
    useEffect(() => {
        fetch('/api/backend/support/tickets', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(payload => setTickets(payload?.tickets || [])).catch(() => undefined)
    }, [])
    return <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'><div className='flex items-center justify-between gap-3'><div><h2 className='text-sm font-semibold text-ui-text'>Support tickets</h2><p className='mt-1 text-xs text-ui-muted'>Your recent conversations with Hanasand support.</p></div><Link href='/support' className='text-xs font-semibold text-ui-primary hover:underline'>Open support</Link></div>{tickets.length ? <div className='grid gap-2'>{tickets.map(ticket => <Link key={ticket.id} href='/support' className='rounded-md border border-ui-border bg-ui-raised p-3 hover:border-ui-primary'><div className='flex justify-between gap-3'><span className='text-sm font-semibold text-ui-text'>{ticket.subject}</span><span className='text-xs text-ui-muted'>{ticket.status}</span></div><p className='mt-1 truncate text-xs text-ui-muted'>{ticket.last_message || 'No messages yet'}</p></Link>)}</div> : <p className='text-sm text-ui-muted'>No support tickets yet.</p>}</section>
}
