import assert from 'node:assert/strict'
import { knownActorProfile, searchThreatIntel } from '../src/utils/ti/search.ts'

for (const actor of ['APT29', 'APT28', 'LockBit']) {
    const profile = knownActorProfile(actor)
    assert(profile, `missing curated profile for ${actor}`)
    assert(!profile.recentActivity?.some(item => /profile updated/i.test(item.title)), `${actor} fabricates a current profile update`)
    if (profile.lastSeen) assert(Number.isFinite(Date.parse(profile.lastSeen)), `${actor} has an invalid last-seen date`)
}

const previousScraperBase = process.env.TI_SCRAPER_API_BASE
delete process.env.TI_SCRAPER_API_BASE
const publicProfile = await searchThreatIntel({ query: 'APT29' })
if (previousScraperBase) process.env.TI_SCRAPER_API_BASE = previousScraperBase
assert.equal(publicProfile.status, 'partial', 'curated context without durable evidence must remain partial')

console.log('Curated actor profiles do not fabricate freshness or claim durable readiness.')
