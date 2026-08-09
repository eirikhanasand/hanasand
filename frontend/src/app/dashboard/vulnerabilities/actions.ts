'use server'

import { getVulnerabilities, getWebScan, triggerVulnerabilityScan, triggerWebScan } from '@/utils/monitoring/data'

export async function refreshVulnerabilityData() {
    return await getVulnerabilities()
}

export async function runVulnerabilityScanAction() {
    return await triggerVulnerabilityScan()
}

export async function refreshWebScan() { return await getWebScan() }
export async function runWebScanAction() { return await triggerWebScan() }
