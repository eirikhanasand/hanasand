import assert from 'node:assert/strict'
import { sandboxResolvedAddressSafety } from '../src/handlers/onionSession/ws.ts'

assert.equal(sandboxResolvedAddressSafety([{ address: '192.168.1.10', family: 4 }]).ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '127.0.0.1', family: 4 }]).ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '::1', family: 6 }]).ok, false)
assert.equal(sandboxResolvedAddressSafety([{ address: '93.184.216.34', family: 4 }]).ok, true)

console.log('Browser DNS-resolved URL safety contract passed.')
