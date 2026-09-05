import assert from 'node:assert/strict'
import type { FastifyRequest } from 'fastify'
import { resolveRateLimitActor } from '../src/plugins/rateLimit.ts'

const request = { ip: '127.0.0.1', headers: { authorization: 'Bearer session-test' } } as FastifyRequest
const unavailable = async () => { throw new Error('database unavailable') }
await assert.rejects(resolveRateLimitActor(request, undefined, unavailable), /database unavailable/, 'Database failure must not become invalid_session and log users out')
const invalid = await resolveRateLimitActor(request, undefined, async () => null)
assert.equal(invalid.invalidSession, true)
console.log('Authentication boundary distinguishes database outages from invalid credentials.')
