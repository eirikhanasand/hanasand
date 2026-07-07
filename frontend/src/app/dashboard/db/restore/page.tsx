import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import RestoreClient from './restoreClient'
import { getBackupFiles } from '@/utils/db/internal'

export default async function DatabaseRestorePage({
    searchParams,
}: {
    searchParams: Promise<{ service?: string, date?: string }>
}) {
    const params = await searchParams
    const backups = await getBackupFiles(params.service, params.date)

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Operations' title='Restore Backup' />
            <RestoreClient backups={typeof backups === 'string' ? [] : backups} loadError={typeof backups === 'string' ? backups : ''} />
        </DashboardPage>
    )
}
