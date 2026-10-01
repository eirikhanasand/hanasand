import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vcl = readFileSync(new URL('../default.vcl', import.meta.url), 'utf8')
const dynamicRoutes = vcl.indexOf('^/(ti|dwm)(?:[/?#]|$)')
const cacheReturn = vcl.indexOf('return (hash);')
const privateResponses = vcl.indexOf('beresp.http.Cache-Control ~ "(?i)(no-cache|no-store|private)"')
const yearLongTtl = vcl.indexOf('set beresp.ttl = 52w;')
const healthCacheRoute = vcl.indexOf('bereq.url ~ "^/(?:dashboard/)?automation/health')
const healthBackgroundFailure = vcl.indexOf('bereq.is_bgfetch && beresp.status >= 500', healthCacheRoute)
const healthFreshTtl = vcl.indexOf('set beresp.ttl = 15s;', healthCacheRoute)
const healthGrace = vcl.indexOf('set beresp.grace = 52w;', healthCacheRoute)
const sessionHash = vcl.indexOf('hash_data(req.http.Cookie);', vcl.indexOf('sub vcl_hash'))

assert(dynamicRoutes >= 0, 'TI and DWM routes must bypass the year-long public HTML cache')
assert(dynamicRoutes < cacheReturn, 'TI and DWM cache bypass must run before Varnish hashes the request')
assert(privateResponses >= 0, 'Private and no-store responses must not enter the public HTML cache')
assert(privateResponses < yearLongTtl, 'Private response handling must run before the year-long cache TTL')
assert(healthCacheRoute >= 0, 'Health page responses need a dedicated cache policy')
assert(healthBackgroundFailure > healthCacheRoute, 'A failed background health-page refresh must preserve the previous response')
assert(healthFreshTtl > healthCacheRoute && healthGrace > healthFreshTtl, 'Health pages must stay fresh briefly and remain available in grace')
assert(sessionHash > vcl.indexOf('sub vcl_hash'), 'Authenticated cache keys must include the complete session cookie')

console.log('Health pages keep a session-keyed response available during background refresh.')
