'use client'

import { useState } from 'react'

type Organization = { id: string, name: string, slug: string, status: string, member_count: number, created_at: string }

export default function OrganizationList({ organizations }: { organizations: Organization[] }) {
    const [search, setSearch] = useState('')
    const query = search.trim().toLowerCase()
    const rows = organizations.filter(org => `${org.name} ${org.slug}`.toLowerCase().includes(query))
    return <div className='p-4'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <p className='text-sm text-ui-muted'>{rows.length} of {organizations.length} organizations</p>
            <input aria-label='Search organizations' type='search' placeholder='Search organizations…' value={search} onChange={event => setSearch(event.target.value)} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-ui-text' />
        </div>
        <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
                <thead className='border-b border-ui-border text-ui-muted'><tr>{['Organization', 'Slug', 'Status', 'Members', 'Created'].map(label => <th key={label} scope='col' className='px-3 py-3 font-medium'>{label}</th>)}</tr></thead>
                <tbody>{rows.map(org => <tr key={org.id} className='border-b border-ui-border text-ui-text'>
                    <td className='px-3 py-3 font-medium'>{org.name}</td>
                    <td className='px-3 py-3 text-ui-muted'>{org.slug}</td>
                    <td className='px-3 py-3 capitalize'>{org.status}</td>
                    <td className='px-3 py-3'>{org.member_count}</td>
                    <td className='whitespace-nowrap px-3 py-3'>{new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC' }).format(new Date(org.created_at))}</td>
                </tr>)}</tbody>
            </table>
            {!rows.length && <p className='py-8 text-center text-ui-muted'>{organizations.length ? 'No organizations match your search.' : 'No organizations found.'}</p>}
        </div>
    </div>
}
