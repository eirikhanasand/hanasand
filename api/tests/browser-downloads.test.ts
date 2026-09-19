import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile, truncate } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileReputation, inspectDownload, MAX_DOWNLOAD_HASH_BYTES } from '../src/handlers/onionSession/downloads.ts'

test('hashes a downloaded file and deletes its temporary artifact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'browser-download-test-'))
    const path = join(directory, 'fixture.txt')
    const body = 'Benign browser download fixture\n'
    let deleted = false
    try {
        await writeFile(path, body)
        const result = await inspectDownload({ path: async () => path, suggestedFilename: () => 'fixture.txt', cancel: async () => {}, delete: async () => { deleted = true; await rm(path) } })
        expect(result.sha256).toBe(createHash('sha256').update(body).digest('hex'))
        expect(result.bytes).toBe(Buffer.byteLength(body))
        expect(deleted).toBe(true)
    } finally { await rm(directory, { recursive: true, force: true }) }
})

test('over-limit artifacts and failed downloads are also deleted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'browser-download-limit-'))
    const path = join(directory, 'large.bin')
    let deleted = 0
    const download = { path: async () => path, suggestedFilename: () => 'large.bin', cancel: async () => {}, delete: async () => { deleted++; await rm(path, { force: true }) } }
    try {
        await writeFile(path, '')
        await truncate(path, MAX_DOWNLOAD_HASH_BYTES + 1)
        expect((await inspectDownload(download)).sha256).toBeUndefined()
        expect(deleted).toBe(1)
        await expect(inspectDownload({ ...download, path: async () => { throw new Error('failed') } })).rejects.toThrow('failed')
        expect(deleted).toBe(2)
    } finally { await rm(directory, { recursive: true, force: true }) }
})

test('VirusTotal distinguishes detections, unknown hashes, access failures and empty results', () => {
    const hash = 'a'.repeat(64)
    expect(fileReputation('{"last_analysis_stats":{"malicious":2,"suspicious":1,"undetected":67}}', hash)).toMatchObject({ status: 'known', flagged: 3, total: 70 })
    expect(fileReputation('0 / 70 security vendors', hash)).toMatchObject({ status: 'known', flagged: 0, total: 70 })
    expect(fileReputation('NotFoundError', hash).status).toBe('unknown')
    expect(fileReputation('captcha', hash).status).toBe('unavailable')
    expect(fileReputation('', hash).status).toBe('unavailable')
    expect(fileReputation('0 / 0 security vendors', hash).status).toBe('unavailable')
    expect(fileReputation('clean', hash).status).toBe('unavailable')
})
