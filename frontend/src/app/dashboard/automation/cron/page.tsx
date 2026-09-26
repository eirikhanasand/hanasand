import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import { loadAutomations } from '@/utils/automations/server'
import AutomationsClient from '../simplePageClient'
import CronJobsClient from './pageClient'
import CronScopeTabs from './scopeTabs'

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const [cookieStore, params] = await Promise.all([cookies(), searchParams])
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) redirect('/login?path=%2Fautomation%2Fcron')
    const initial = await loadAutomations(undefined, 'personal')
    const system = params?.scope === 'system'
    return <DashboardPage>
        <DashboardHeader title={system ? 'System jobs' : 'Personal cron jobs'} description={system ? 'Manage the service’s background jobs.' : 'Schedule your own checks and reminders. Your jobs are private to your account.'} />
        <CronScopeTabs system={system} personalCount={initial.automations.length} systemCount={initial.systemJobCount} canManageSystem={initial.canManageSystem === true} />
        {system ? initial.canManageSystem ? <CronJobsClient /> : <ErrorNotice message={initial.error || 'You don’t have access to system jobs. You can create your own personal jobs.'} /> : <AutomationsClient initial={initial} mode='cron' systemJobCount={initial.systemJobCount} />}
    </DashboardPage>
}
