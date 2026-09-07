import getStatus, { type ServiceStatus } from './getStatus'
import { isVerifiedStatus, retainVerifiedStatus, toPublicServiceStatus } from './publicStatus'

let lastVerified: ServiceStatus | undefined
export default async function getPublicStatus() {
    const next = toPublicServiceStatus(await getStatus())
    const result = retainVerifiedStatus(next, lastVerified)
    if (isVerifiedStatus(next)) lastVerified = next
    return result
}
