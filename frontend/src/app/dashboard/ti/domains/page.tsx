import Link from 'next/link'
import { ExternalLink, Globe2 } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default function TiDomainsPage() {
    const { domains } = getTiAdminOverview()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Domains and surfaced results'
                description='See exactly which monitored domains or companies are producing results and which sources surfaced them.'
            />

            <DashboardPanel className='overflow-x-auto'>
                <div className='min-w-[48rem]'>
                    <div className='grid grid-cols-[1fr_1fr_0.8fr_0.6fr_auto] gap-3 bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase text-[#667085]'>
                        <span>Domain</span>
                        <span>Company</span>
                        <span>Sources</span>
                        <span>Results</span>
                        <span>Open</span>
                    </div>
                    {domains.map(domain => (
                        <Link key={domain.domain} href={`/dashboard/ti/domains/${encodeURIComponent(domain.domain)}`} className='grid grid-cols-[1fr_1fr_0.8fr_0.6fr_auto] gap-3 border-t border-[#eef1f5] px-4 py-3 text-sm hover:bg-[#fbfcfe]'>
                            <span className='min-w-0 truncate font-mono font-semibold text-[#171a21]'>{domain.domain}</span>
                            <span className='min-w-0 truncate text-[#344054]'>{domain.company}</span>
                            <span className='min-w-0 truncate text-[#596170]'>{domain.sourceIds.map(id => sourceById(id)?.name || id).join(', ')}</span>
                            <span className='text-[#3056d3]'>{domain.resultCount}</span>
                            <ExternalLink className='h-4 w-4 text-[#667085]' />
                        </Link>
                    ))}
                </div>
            </DashboardPanel>

            <div className='grid gap-4 lg:grid-cols-2'>
                {domains.map(domain => (
                    <DashboardPanel key={domain.domain} className='p-5'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <div className='flex items-center gap-2 text-[#3056d3]'>
                                    <Globe2 className='h-4 w-4' />
                                    <p className='text-xs font-semibold uppercase'>{domain.status}</p>
                                </div>
                                <h2 className='mt-2 text-lg font-semibold text-[#171a21]'>{domain.company}</h2>
                                <p className='mt-1 font-mono text-sm text-[#596170]'>{domain.domain}</p>
                            </div>
                            <span className='rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{domain.resultCount} results</span>
                        </div>
                        <div className='mt-4 grid gap-2'>
                            <Info label='Last seen' value={formatTiDate(domain.lastSeenAt)} />
                            <Info label='Matched terms' value={domain.matchedTerms.join(', ')} />
                            <Info label='Sources' value={domain.sourceIds.map(id => sourceById(id)?.name || id).join(', ')} />
                        </div>
                    </DashboardPanel>
                ))}
            </div>
        </DashboardPage>
    )
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}
