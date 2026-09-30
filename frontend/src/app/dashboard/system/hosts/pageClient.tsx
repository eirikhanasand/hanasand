'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, LoaderCircle, SquareTerminal } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { getHostOverview, type HostAccessUser, type HostOverview } from '@/utils/sshKeys'

export default function HostsOverview() {
    const [hosts, setHosts] = useState<HostOverview[]>([])
    const [users, setUsers] = useState<HostAccessUser[]>([])
    const [openAccess, setOpenAccess] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        void getHostOverview().then(data => {
            if (!active) return
            setHosts(data.hosts)
            setUsers(data.users)
        }).catch(cause => {
            if (active) setError(cause instanceof Error ? cause.message : 'Unable to load hosts.')
        }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    if (loading) return <div role='status' className='flex items-center gap-2 py-8 text-sm text-ui-muted'><LoaderCircle className='h-4 w-4 animate-spin' />Loading hosts…</div>
    if (error) return <p role='alert' className='rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-4 text-sm text-ui-danger'>{error}</p>

    return <div className='grid gap-4 lg:grid-cols-2'>
        {hosts.map(host => <DashboardPanel key={host.id} className='h-fit p-4'>
            <div className='flex items-start justify-between gap-4'>
                <div className='min-w-0'>
                    <h2 className='text-lg font-semibold text-ui-text'>{host.name}</h2>
                    <p className='mt-1 flex items-center gap-2 text-sm text-ui-muted'>
                        <span className={`h-2 w-2 rounded-full ${host.status === 'online' ? 'bg-ui-success' : 'bg-ui-danger'}`} aria-hidden />
                        {host.status === 'online' ? 'Online' : 'Offline'}
                    </p>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                    <Link href={`/system/console?host=${host.id}`} aria-label={`Open ${host.name} console`} title={`${host.name} console`} className='rounded-lg border border-ui-border p-2 text-ui-muted transition hover:border-ui-primary hover:text-ui-primary'><SquareTerminal className='h-4 w-4' /></Link>
                    <button type='button' aria-label={`Show SSH access for ${host.name}`} aria-expanded={openAccess === host.id} title={`${host.name} SSH access`} onClick={() => setOpenAccess(openAccess === host.id ? null : host.id)} className={`rounded-lg border border-ui-border p-2 transition hover:border-ui-primary hover:text-ui-primary ${openAccess === host.id ? 'border-ui-primary text-ui-primary' : 'text-ui-muted'}`}><KeyRound className='h-4 w-4' /></button>
                </div>
            </div>
            <dl className='mt-4 grid gap-x-4 gap-y-3 border-t border-ui-border pt-4 text-sm sm:grid-cols-2'>
                <Metadata label='Address' value={host.address} />
                <Metadata label='SSH user' value={host.username} />
                <Metadata label='Hostname' value={host.hostname || 'Unavailable'} />
                <Metadata label='Operating system' value={host.operatingSystem || 'Unavailable'} />
            </dl>
            {openAccess === host.id && <section className='mt-4 border-t border-ui-border pt-4'>
                <h3 className='text-sm font-semibold text-ui-text'>Users with SSH keys</h3>
                {users.length ? <ul className='mt-2 divide-y divide-ui-border'>
                    {users.map(user => <li key={user.id} className='flex items-center justify-between gap-3 py-2 text-sm'>
                        <span className='min-w-0 truncate text-ui-text'>{user.name}<span className='ml-2 text-ui-muted'>@{user.username}</span></span>
                        <span className='shrink-0 text-xs text-ui-muted'>{user.keyCount} {user.keyCount === 1 ? 'key' : 'keys'}</span>
                    </li>)}
                </ul> : <p className='mt-2 text-sm text-ui-muted'>No users have added an SSH key.</p>}
            </section>}
        </DashboardPanel>)}
    </div>
}

function Metadata({ label, value }: { label: string, value: string }) {
    return <div className='min-w-0'><dt className='text-xs text-ui-muted'>{label}</dt><dd className='mt-0.5 truncate font-medium text-ui-text'>{value}</dd></div>
}
