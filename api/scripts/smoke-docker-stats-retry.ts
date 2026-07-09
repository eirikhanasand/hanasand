import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../src/utils/docker/engine.ts', import.meta.url), 'utf8')

assert(source.includes('req.setTimeout(4_000'), 'Docker API requests should time out instead of hanging dashboard actions.')
assert(source.includes('if (stats.cpu_percent !== null) return stats'), 'Docker stats should keep the fast path when CPU is available.')
assert(source.includes('setTimeout(resolve, 300)'), 'Docker stats should take a second sample when the first CPU delta is missing.')
assert(source.match(/\/containers\/\$\{id\}\/stats\?stream=false/g)?.length === 2, 'Docker stats retry should read the same non-streaming endpoint twice.')

