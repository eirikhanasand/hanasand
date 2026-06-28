import Link from 'next/link'
import { Activity, ArrowLeft, DatabaseZap, ExternalLink } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import TiScraperControlClient from './scraperControlClient'

export const dynamic = 'force-dynamic'

export default function TiScraperControlPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Scraper control room'
                description='Operate the collection pipeline: queue work, inspect source health, review dry-run plans, watch evidence flow, and see exactly what powers the public TI pages.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/ti' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            <ArrowLeft className='h-4 w-4' />
                            TI overview
                        </Link>
                        <Link href='/dashboard/ti/workbench' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            <Activity className='h-4 w-4' />
                            Analyst workbench
                        </Link>
                        <Link href='/dashboard/ti/sources' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <DatabaseZap className='h-4 w-4' />
                            Sources
                            <ExternalLink className='h-4 w-4' />
                        </Link>
                    </div>
                )}
            />
            <TiScraperControlClient />
        </DashboardPage>
    )
}
