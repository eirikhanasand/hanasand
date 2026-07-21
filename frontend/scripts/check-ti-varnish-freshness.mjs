import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vcl = readFileSync(new URL('../default.vcl', import.meta.url), 'utf8')
const dynamicRoutes = vcl.indexOf('^/(ti|dwm)(?:[/?#]|$)')
const cacheReturn = vcl.indexOf('return (hash);')

assert(dynamicRoutes >= 0, 'TI and DWM routes must bypass the year-long public HTML cache')
assert(dynamicRoutes < cacheReturn, 'TI and DWM cache bypass must run before Varnish hashes the request')

console.log('TI and DWM public routes bypass the static HTML cache.')
