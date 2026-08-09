'use server'

import { getVulnerabilities, getWebScan, triggerVulnerabilityScan, triggerWebScan, updateWebScanSchedule } from '@/utils/monitoring/data'

export async function refreshVulnerabilityData() {
    return await getVulnerabilities()
}

export async function runVulnerabilityScanAction() {
    return await triggerVulnerabilityScan()
}

export async function refreshWebScan() { return await getWebScan() }
export async function runWebScanAction() { return await triggerWebScan() }
export async function updateWebScanScheduleAction(input: { enabled?: boolean, intervalMinutes?: number }) { return await updateWebScanSchedule(input) }
