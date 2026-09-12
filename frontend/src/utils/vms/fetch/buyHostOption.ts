export type HostOption = 'always_running' | 'failover'

export default async function buyHostOption(vmName: string, feature: HostOption) {
    const response = await fetch('/api/backend/billing/container-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmName, feature }),
    })
    const data = await response.json()
    if (!response.ok || !data.url) throw new Error(data.error || 'Checkout could not be opened.')
    const destination = new URL(data.url)
    if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout destination.')
    window.location.assign(destination.href)
}
