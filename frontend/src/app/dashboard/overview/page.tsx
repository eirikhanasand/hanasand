import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import DwmOverviewPanel from './dwmOverviewPanel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Overview',
    description: 'A focused view of monitoring, alerts, cases, and service health that matter now.',
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const token = (await cookies()).get('access_token')?.value

    if (!token) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard/overview%26expired=true')
    }

    const params = searchParams ? await searchParams : {}
    const deniedPathValue = params.from
    const deniedPath = typeof deniedPathValue === 'string' && deniedPathValue.startsWith('/') ? deniedPathValue : ''
    const accessDenied = params.notAllowed === 'true'

    return (
        <DashboardPage>
            <DashboardHeader
                title='Overview'
                description='A focused view of monitoring, alerts, cases, and service health that matter now.'
                eyebrow='Dashboard'
            />

            {accessDenied ? (
                <div role='alert'>
                    <DashboardPanel className='border-ui-warning/40 bg-ui-warning/10 p-4'>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-warning'>Access boundary</p>
                                <h2 className='mt-1 text-base font-semibold text-ui-text'>That dashboard route is restricted for your current role.</h2>
                                <p className='mt-1 max-w-2xl text-sm leading-6 text-ui-muted'>
                                    {deniedPath ? `Requested route: ${deniedPath}. ` : ''}Your session is still active. Use the routes shown in the sidebar, or ask an organization administrator to confirm the required role.
                                </p>
                            </div>
                            <Link href='/organizations' className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Open organization access
                            </Link>
                        </div>
                    </DashboardPanel>
                </div>
            ) : null}

            <DwmOverviewPanel organizationId={firstParam(params.organizationId) || firstParam(params.orgId)} />
        </DashboardPage>
    )
}

function firstParam(value: string | string[] | undefined) {
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined
}
