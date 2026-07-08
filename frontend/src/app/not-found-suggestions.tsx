'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { suggestRoutes } from '@/utils/routes/routeSuggestions'

export default function NotFoundSuggestions() {
    const suggestions = suggestRoutes(usePathname() || '')

    if (!suggestions.length) return null

    return (
        <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-5'>
            <div className='grid gap-1'>
                <h2 className='text-lg font-semibold text-ui-text'>Did you mean?</h2>
                <p className='text-sm text-ui-muted'>These routes are close to the URL you entered.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
                {suggestions.map(route => (
                    <Link key={route} href={route} className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                        {route}
                        <ArrowRight className='h-4 w-4 text-ui-muted' />
                    </Link>
                ))}
            </div>
        </section>
    )
}
