import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readDatabaseStorage } from '../src/utils/db/storage.ts'

const original = process.env.DB_STORAGE_METRICS_FILE
const directories: string[] = []
afterEach(async () => {
    if (original === undefined) delete process.env.DB_STORAGE_METRICS_FILE
    else process.env.DB_STORAGE_METRICS_FILE = original
    for (const directory of directories.splice(0)) await rm(directory, { recursive: true })
})

test('storage distinguishes fresh, stale and unavailable measurements', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'db-storage-'))
    directories.push(directory)
    const file = join(directory, 'databases.json')
    process.env.DB_STORAGE_METRICS_FILE = file
    expect(await readDatabaseStorage()).toBeNull()
    const snapshot = { sampledAt: new Date().toISOString(), host: 'test', disk: { availableBytes: 100 }, instances: [] }
    await writeFile(file, JSON.stringify(snapshot))
    expect((await readDatabaseStorage())?.stale).toBe(false)
    await writeFile(file, JSON.stringify({ ...snapshot, sampledAt: new Date(Date.now() - 181000).toISOString() }))
    expect((await readDatabaseStorage())?.stale).toBe(true)
    await writeFile(file, '{broken')
    expect(await readDatabaseStorage()).toBeNull()
})
