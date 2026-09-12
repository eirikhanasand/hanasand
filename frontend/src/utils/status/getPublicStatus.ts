import getStatus, { type ServiceStatus } from './getStatus'
import { isVerifiedStatus, retainVerifiedStatus, toPublicServiceStatus } from './publicStatus'

let lastVerified: ServiceStatus | undefined
export default async function getPublicStatus({ incidentId }: { incidentId?: string } = {}) {
    const next = toPublicServiceStatus(await getStatus({ incidentId }))
    // A selected incident must never fall back to the full dashboard snapshot.
    if (incidentId) return next
    const result = retainVerifiedStatus(next, lastVerified)
    if (isVerifiedStatus(next)) lastVerified = next
    return result
}
