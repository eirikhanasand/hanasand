import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import { loadAutomations } from '@/utils/automations/server'
import AutomationsClient from '../simplePageClient'
import CronJobsClient from './pageClient'

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const [cookieStore, params] = await Promise.all([cookies(), searchParams])
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) redirect('/login?path=%2Fautomation%2Fcron')
    const initial = await loadAutomations(undefined, 'personal')
    const system = params?.scope === 'system'
    return <DashboardPage>
        <DashboardHeader title={system ? 'System jobs' : 'Personal cron jobs'} description={system ? 'Manage the service’s background jobs.' : 'Schedule your own checks and reminders. Your jobs are private to your account.'} />
        <nav aria-label='Cron job scope' className='flex gap-4 text-sm text-ui-primary'>
            <Link href='/automation/cron' aria-current={!system ? 'page' : undefined}>Personal jobs</Link>
            {initial.canManageSystem && <Link href='/automation/cron?scope=system' aria-current={system ? 'page' : undefined}>System jobs</Link>}
        </nav>
        {system ? initial.canManageSystem ? <CronJobsClient /> : <ErrorNotice message={initial.error || 'You don’t have access to system jobs. You can create your own personal jobs.'} /> : <AutomationsClient initial={initial} mode='cron' />}
    </DashboardPage>
}
