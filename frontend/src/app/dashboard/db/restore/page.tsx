import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import RestoreClient from './restoreClient'
import LiveRestoreClient from './liveRestoreClient'
import { getBackupFiles, getBackupServices } from '@/utils/db/internal'

export default async function DatabaseRestorePage({
    searchParams,
}: {
    searchParams: Promise<{ service?: string, date?: string, mode?: string, file?: string }>
}) {
    const params = await searchParams
    const [backups, services] = await Promise.all([getBackupFiles(params.service, params.date), getBackupServices()])
    const errors = [typeof backups === 'string' ? backups : '', typeof services === 'string' ? services : ''].filter(Boolean).join(' ')

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Operations' title='Restore Backup' />
            {params.mode === 'live'
                ? <LiveRestoreClient backups={typeof backups === 'string' ? [] : backups} service={typeof services === 'string' ? undefined : services[0]} file={params.file || ''} loadError={errors} />
                : <RestoreClient backups={typeof backups === 'string' ? [] : backups} service={typeof services === 'string' ? undefined : services[0]} loadError={errors} />}
        </DashboardPage>
    )
}
