import { cookies } from 'next/headers'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import { getDatabaseOverview } from '@/utils/db/internal'
import { DatabaseActions, DatabaseDashboard } from './databaseDashboard'

export default async function DatabasePage() {
    const id = (await cookies()).get('id')?.value || ''
    const serviceAccount = id.startsWith('svc_')
    const overview = await getDatabaseOverview()

    if (typeof overview === 'string') {
        return (
            <DashboardPage>
                <DashboardHeader eyebrow='Operations' title='Database' actions={<DatabaseActions />} />
                <DashboardPanel className='p-5'>
                    <ErrorNotice message={operatorFetchError(overview)} />
                </DashboardPanel>
            </DashboardPage>
        )
    }

    return <DatabaseDashboard overview={overview} serviceAccount={serviceAccount} />
}

function operatorFetchError(message: string) {
    return message.replace(/^Error:\s*/i, 'Database telemetry is reconnecting: ')
}
