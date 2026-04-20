'use client'

import { Search as SearchIcon } from 'lucide-react'

export default function Search(props: { className?: string, innerClassname?: string }) {
    return (
        <div className={props.className || ''}>
            <div className={`flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-bright/50 ${props.innerClassname || ''}`}>
                <SearchIcon className='h-4 w-4' />
                <span>Search</span>
            </div>
        </div>
    )
}
