import type { Metadata } from 'next'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { getWebScan } from '@/utils/monitoring/data'
import { refreshWebScan, runWebScanAction, updateWebScanScheduleAction } from '../vulnerabilities/actions'
import WebScanPanel from '../vulnerabilities/webScanPanel'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Security Scanner', description: 'Run and schedule web validation scans.' }

export default async function ScannerPage() {
    return <DashboardPage><DashboardHeader eyebrow='Security operations' title='Security Scanner' description='Run and schedule web validation scans.' /><WebScanPanel initialData={await getWebScan()} refreshAction={refreshWebScan} runAction={runWebScanAction} scheduleAction={updateWebScanScheduleAction} /></DashboardPage>
}
