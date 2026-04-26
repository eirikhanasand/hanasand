import assert from 'node:assert/strict'
import { inferDeployDefaults, parseHealthcheckUrlDefaults } from '../src/utils/ai/deploy.ts'

const inferredFastify = inferDeployDefaults('fastify_postgres')
assert.equal(inferredFastify.port, 3001, 'Fastify stacks should default to port 3001.')
assert.equal(inferredFastify.healthPath, '/ready', 'Fastify stacks should default to /ready.')
assert.equal(inferredFastify.inferred, true, 'Fastify defaults should report inferred values when no input is provided.')

const explicitFastify = inferDeployDefaults('fastify_postgres', {
    port: 4010,
    healthPath: '/healthz',
})
assert.equal(explicitFastify.port, 4010, 'Explicit deploy ports must win over stack defaults.')
assert.equal(explicitFastify.healthPath, '/healthz', 'Explicit health paths must win over stack defaults.')
assert.equal(explicitFastify.inferred, false, 'Explicit deploy settings should not report inferred defaults.')

const inferredNext = inferDeployDefaults('nextjs_docker')
assert.equal(inferredNext.port, 3000, 'Next.js Docker stacks should keep the 3000 default.')
assert.equal(inferredNext.healthPath, '/', 'Next.js Docker stacks should keep the root health path.')

const restored = parseHealthcheckUrlDefaults('http://127.0.0.1:3001/ready', 'fastify_worker_redis')
assert.equal(restored.port, 3001, 'Restore parsing should preserve the original release port.')
assert.equal(restored.healthPath, '/ready', 'Restore parsing should preserve the original release health path.')
assert.equal(restored.inferred, false, 'Restore parsing should report explicit release metadata.')

console.log('AI deploy default smoke passed.')
