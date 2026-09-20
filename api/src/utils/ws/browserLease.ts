export class BrowserLeaseExpiredError extends Error {}

// A persisted lease lasts two minutes. Stop thirty seconds early if renewal
// keeps failing, but do not interrupt browsing for a single lost DB connection.
export function browserLeaseHeartbeat(renew: () => Promise<void>, onLost: () => void, now = Date.now) {
    let deadline = now() + 90_000
    let renewing = false
    let lost = false
    const lose = () => { if (!lost) { lost = true; onLost() } }
    return async () => {
        if (lost) return
        if (now() >= deadline) { lose(); return }
        if (renewing) return
        renewing = true
        const started = now()
        try {
            await renew()
            deadline = started + 90_000
        } catch (error) {
            if (error instanceof BrowserLeaseExpiredError || now() >= deadline) lose()
        } finally {
            renewing = false
        }
    }
}
