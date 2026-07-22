import Link from 'next/link'
import { Flame } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import LoadTestingOperations from './pageClient'

export const dynamic = 'force-dynamic'

const allowances = [
    { name: 'Evaluation', availability: 'Active', checks: '5 total', operation: 'Manual', cta: 'Start check', href: '/test' },
    { name: 'Higher allowance', availability: 'Sales scoped', checks: 'Written scope', operation: 'Provisioned', cta: 'Request access', href: '/contact?intent=load-testing' },
]

export default function LoadTestingPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Service checks'
                title='Load testing and endpoint evidence'
                description='Run permitted HTTP checks, inspect latency and failure evidence, and reopen every result from one operations view.'
                actions={(
                    <Link href='/test' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                        <Flame className='h-4 w-4' />
                        Start a check
                    </Link>
                )}
            />

            <LoadTestingOperations />

            <DashboardPanel className='overflow-hidden p-0'>
                <details data-load-test-allowance-disclosure>
                    <summary className='flex cursor-pointer list-none flex-col gap-1 border-b border-ui-border bg-ui-raised px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                        <span>Run allowance</span>
                        <span className='text-xs font-medium text-ui-muted'>Current evaluation and managed provisioning</span>
                    </summary>
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-ui-border text-sm'>
                            <thead className='bg-ui-panel text-left text-xs font-semibold uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-4 py-3'>Access</th>
                                    <th className='px-4 py-3'>Availability</th>
                                    <th className='px-4 py-3'>Allowance</th>
                                    <th className='px-4 py-3'>Operation</th>
                                    <th className='px-4 py-3 text-right'>Action</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                {allowances.map((allowance) => (
                                    <tr key={allowance.name} className='hover:bg-ui-raised'>
                                        <td className='px-4 py-4 font-semibold text-ui-text'>{allowance.name}</td>
                                        <td className='px-4 py-4 text-ui-muted'>{allowance.availability}</td>
                                        <td className='px-4 py-4 font-semibold text-ui-primary'>{allowance.checks}</td>
                                        <td className='px-4 py-4 text-ui-muted'>{allowance.operation}</td>
                                        <td className='px-4 py-4 text-right'>
                                            <Link href={allowance.href} className='inline-flex h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                                                {allowance.cta}
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            </DashboardPanel>
        </DashboardPage>
    )
}
