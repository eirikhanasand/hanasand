#!/usr/bin/env node
/** Copy the canonical support snapshot to Inspur through its private SSH tunnel. */
import { createWriteStream } from 'node:fs'
import { mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const config = JSON.parse(await readFile('/home/hanasand/hanasand/ops/runtime/support.json', 'utf8'))
if (config.SUPPORT_SERVICE_BASE !== 'http://127.0.0.1:29181' || typeof config.SUPPORT_SERVICE_KEY !== 'string') throw new Error('Invalid private support backup configuration')
const destination = '/home/hanasand/hanasand/ops/runtime/support-backups'
await mkdir(destination, { recursive: true, mode: 0o700 })
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const temporary = path.join(destination, `${stamp}.partial`)
const saved = path.join(destination, `${stamp}.dump`)
try {
    const response = await fetch(`${config.SUPPORT_SERVICE_BASE}/backup`, { headers: { 'x-support-service-key': config.SUPPORT_SERVICE_KEY }, signal: AbortSignal.timeout(60_000) })
    if (!response.ok || !response.body) throw new Error(`Support backup endpoint failed with HTTP ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx', mode: 0o600 }))
    const input = await open(temporary, 'r')
    try {
        const header = Buffer.alloc(5)
        const { bytesRead } = await input.read(header, 0, 5, 0)
        if (bytesRead !== 5 || header.toString() !== 'PGDMP') throw new Error('Invalid PostgreSQL support snapshot')
    } finally { await input.close() }
    await rename(temporary, saved)
    const dumps = (await readdir(destination)).filter(name => name.endsWith('.dump')).sort()
    for (const old of dumps.slice(0, -48)) await unlink(path.join(destination, old))
    console.log('Support snapshot copied')
} finally {
    await unlink(temporary).catch(() => {})
}
