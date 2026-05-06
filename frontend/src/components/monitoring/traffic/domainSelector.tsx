'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type DomainSelectorProps = {
    domains: string[]
    selectedDomain?: string
}

export default function DomainSelector({ domains, selectedDomain }: DomainSelectorProps) {
    const router = useRouter()
    const [value, setValue] = useState(selectedDomain || '')

    function handleChange(domain: string) {
        setValue(domain)
        const params = new URLSearchParams(window.location.search)

        if (domain) {
            params.set('domain', domain)
        } else {
            params.delete('domain')
        }

        router.push(`${window.location.pathname}?${params.toString()}`)
    }

    return (
        <label className='flex max-w-xs flex-col gap-2 text-sm text-bright/65'>
            <span>Select Domain</span>
            <select
                name='domain-select'
                value={value}
                onChange={(event) => handleChange(event.target.value)}
                className='rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-bright outline-none transition focus:border-[#f07d33]/50'
            >
                <option value=''>All Domains</option>
                {domains.map((domain) => (
                    <option key={domain} value={domain}>{domain}</option>
                ))}
            </select>
        </label>
    )
}
