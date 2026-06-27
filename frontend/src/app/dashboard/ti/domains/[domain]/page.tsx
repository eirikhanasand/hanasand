import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Camera, DatabaseZap } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { domainCaptures, formatTiDate, getTiAdminDomain, sourceById } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiDomainDetailPage(props: { params: Promise<{ domain: string }> }) {
    const params = await props.params
    const domain = getTiAdminDomain(params.domain)

    if (!domain) {
        return notFound()
    }

    const captures = domainCaptures(domain.domain)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence domain'
                title={domain.company}
                description={`Domain result mapping for ${domain.domain}.`}
            />

            <div className='flex'>
                <Link href='/dashboard/ti/domains' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                    <ArrowLeft className='h-4 w-4' />
                    Domains
                </Link>
            </div>

            <div className='grid gap-4 lg:grid-cols-4'>
                <Info label='Domain' value={domain.domain} />
                <Info label='Status' value={domain.status} />
                <Info label='Result count' value={`${domain.resultCount}`} />
                <Info label='Last seen' value={formatTiDate(domain.lastSeenAt)} />
            </div>

            <DashboardPanel className='p-5'>
                <div className='flex items-center gap-2'>
                    <DatabaseZap className='h-4 w-4 text-[#3056d3]' />
                    <h2 className='text-lg font-semibold text-[#171a21]'>Sources surfacing this domain</h2>
                </div>
                <div className='mt-4 grid gap-3 lg:grid-cols-2'>
                    {domain.sourceIds.map(id => {
                        const source = sourceById(id)

                        return (
                            <Link key={id} href={`/dashboard/ti/sources/${id}`} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 hover:border-[#c8d1df]'>
                                <p className='text-base font-semibold text-[#171a21]'>{source?.name || id}</p>
                                <p className='mt-1 text-sm text-[#596170]'>{source?.buyerValue || 'Source metadata unavailable.'}</p>
                                <div className='mt-3 flex flex-wrap gap-2'>
                                    {source?.resultTypes.map(type => <span key={type} className='rounded-full bg-[#eef3ff] px-2 py-1 font-mono text-xs text-[#3056d3]'>{type}</span>)}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-5'>
                <div className='flex items-center gap-2'>
                    <Camera className='h-4 w-4 text-[#3056d3]' />
                    <h2 className='text-lg font-semibold text-[#171a21]'>Domain screenshots and details</h2>
                </div>
                <div className='mt-4 grid gap-4'>
                    {captures.map(capture => (
                        <article key={capture.id} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 lg:grid-cols-[22rem_1fr]'>
                            <div className='grid min-h-48 content-between rounded-lg bg-[#0e1520] p-4 text-white'>
                                <span className='w-fit rounded-full bg-white/10 px-2 py-1 text-xs'>{capture.actor}</span>
                                <div>
                                    <p className='text-xl font-semibold'>{capture.domain}</p>
                                    <p className='mt-1 text-xs text-[#c7d0df]'>{capture.screenshotLabel}</p>
                                </div>
                            </div>
                            <div>
                                <h3 className='text-lg font-semibold text-[#171a21]'>{capture.title}</h3>
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{capture.resultSummary}</p>
                                <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                                    <Info label='Published' value={formatTiDate(capture.publishedAt)} />
                                    <Info label='Captured' value={formatTiDate(capture.capturedAt)} />
                                    <Info label='Owner' value={capture.owner} />
                                    <Info label='Page type' value={capture.pageType} />
                                </div>
                            </div>
                        </article>
                    ))}
                    {!captures.length && <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>No screenshots are attached to this domain yet.</p>}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <DashboardPanel className='p-4'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value}</p>
        </DashboardPanel>
    )
}
