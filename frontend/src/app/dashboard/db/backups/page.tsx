import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import BackupPage from './backupPage'
import { getBackupServices } from '@/utils/db/internal'

export default async function DatabaseBackupsPage() {
    const backups = await getBackupServices()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Operations'
                title='Database Backups'
                description='Backup health, restore lanes, schedule, and storage context for the production database.'
            />
            <BackupPage backups={typeof backups === 'string' ? [] : backups} loadError={typeof backups === 'string' ? backups : ''} />
        </DashboardPage>
    )
}
