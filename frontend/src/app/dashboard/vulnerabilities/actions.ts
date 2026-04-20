'use server'

import { getVulnerabilities, triggerVulnerabilityScan } from '@/utils/monitoring/data'

export async function refreshVulnerabilityData() {
    return await getVulnerabilities()
}

export async function runVulnerabilityScanAction() {
    return await triggerVulnerabilityScan()
}
