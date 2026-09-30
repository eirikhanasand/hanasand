import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DashboardDataFallback, DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { getWebScan } from '@/utils/monitoring/data'
import { refreshWebScan, runWebScanAction, updateWebScanScheduleAction } from '../vulnerabilities/actions'
import WebScanPanel from '../vulnerabilities/webScanPanel'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Security Scanner', description: 'Run and schedule web validation scans.' }

export default function ScannerPage() {
    return <DashboardPage><DashboardHeader eyebrow='Security operations' title='Security Scanner' description='Run and schedule web validation scans.' /><Suspense fallback={<DashboardDataFallback label='scanner results' />}><ScannerData /></Suspense></DashboardPage>
}

async function ScannerData() {
    const initialData = await getWebScan()
    return <WebScanPanel initialData={initialData} refreshAction={refreshWebScan} runAction={runWebScanAction} scheduleAction={updateWebScanScheduleAction} />
}
