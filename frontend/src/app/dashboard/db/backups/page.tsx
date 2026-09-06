import ResiliencePanel from '@/components/system/resilience'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import BackupPage from './backupPage'
import { getBackupFiles, getBackupServices } from '@/utils/db/internal'

export default async function DatabaseBackupsPage() {
    const [backups, files] = await Promise.all([getBackupServices(), getBackupFiles()])
    const errors = [typeof backups === 'string' ? backups : '', typeof files === 'string' ? files : ''].filter(Boolean).join(' ')

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Operations'
                title='Database Backups'
                description='Backup health, restore lanes, schedule, and storage context for the production database.'
            />
            <ResiliencePanel />
            <BackupPage backups={typeof backups === 'string' ? [] : backups} files={typeof files === 'string' ? [] : files} loadError={errors} />
        </DashboardPage>
    )
}
