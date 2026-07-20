import assert from 'node:assert/strict'
import { knownActorProfile } from '../src/utils/ti/search.ts'

for (const actor of ['APT29', 'APT28', 'LockBit']) {
    const profile = knownActorProfile(actor)
    assert(profile, `missing curated profile for ${actor}`)
    assert(!profile.recentActivity?.some(item => /profile updated/i.test(item.title)), `${actor} fabricates a current profile update`)
    if (profile.lastSeen) assert(Number.isFinite(Date.parse(profile.lastSeen)), `${actor} has an invalid last-seen date`)
}

console.log('Curated actor profiles do not fabricate current activity timestamps.')
