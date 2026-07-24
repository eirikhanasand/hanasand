import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vcl = readFileSync(new URL('../default.vcl', import.meta.url), 'utf8')
const dynamicRoutes = vcl.indexOf('^/(ti|dwm)(?:[/?#]|$)')
const cacheReturn = vcl.indexOf('return (hash);')
const privateResponses = vcl.indexOf('beresp.http.Cache-Control ~ "(?i)(no-cache|no-store|private)"')
const yearLongTtl = vcl.indexOf('set beresp.ttl = 52w;')

assert(dynamicRoutes >= 0, 'TI and DWM routes must bypass the year-long public HTML cache')
assert(dynamicRoutes < cacheReturn, 'TI and DWM cache bypass must run before Varnish hashes the request')
assert(privateResponses >= 0, 'Private and no-store responses must not enter the public HTML cache')
assert(privateResponses < yearLongTtl, 'Private response handling must run before the year-long cache TTL')

console.log('Dynamic and private responses bypass the static HTML cache.')
