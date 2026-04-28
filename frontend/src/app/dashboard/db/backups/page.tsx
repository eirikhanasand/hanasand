import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import BackupPage from './backupPage'
import { getBackupServices } from '@/utils/db/internal'

export default async function DatabaseBackupsPage() {
    const backups = await getBackupServices()

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Operations' title='Database Backups' />
            <BackupPage backups={typeof backups === 'string' ? [] : backups} />
        </DashboardPage>
    )
}
