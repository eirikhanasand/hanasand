import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'

const updateDir = await mkdtemp(path.join(tmpdir(), 'hanasand-app-update-'))
const artifactName = 'Login_Desktop_0.1.2_aarch64.app.tar.gz'
const artifactBody = 'signed updater bytes'

await writeFile(path.join(updateDir, artifactName), artifactBody)
await writeFile(path.join(updateDir, 'latest.json'), JSON.stringify({
    version: '0.1.2',
    notes: 'Smoke update',
    pub_date: '2026-04-26T00:00:00Z',
    platforms: {
        'darwin-aarch64': {
            signature: 'smoke-signature',
            url: `https://hanasand.com/api/app/download/${artifactName}`,
        },
    },
}, null, 2))

process.env.HANASAND_APP_UPDATE_DIR = updateDir
process.env.HANASAND_APP_API_BASE = 'http://127.0.0.1:18111/api'
delete process.env.HANASAND_APP_UPDATE_FILE
delete process.env.HANASAND_APP_VERSION
delete process.env.HANASAND_APP_UPDATE_SIGNATURE

const {
    downloadAppUpdate,
    downloadNamedAppUpdate,
    getAppUpdate,
    getTauriAppUpdate,
} = await import('../src/handlers/app/get.ts')

const app = Fastify()
app.get('/api/app', getAppUpdate)
app.get('/api/app/:target/:version', getTauriAppUpdate)
app.get('/api/app/download', downloadAppUpdate)
app.get('/api/app/download/:name', downloadNamedAppUpdate)

const appManifestResponse = await app.inject('/api/app?platform=macos&version=0.1.1')
assert.equal(appManifestResponse.statusCode, 200)
const appManifest = appManifestResponse.json()
assert.equal(appManifest.latest_version, '0.1.2')
assert.equal(appManifest.update_available, true)
assert.equal(appManifest.notes, 'Smoke update')
assert.equal(appManifest.download_url, `http://127.0.0.1:18111/api/app/download/${artifactName}`)
assert.equal(appManifest.package_size, Buffer.byteLength(artifactBody))
assert.match(appManifest.sha256, /^[a-f0-9]{64}$/)

const tauriManifestResponse = await app.inject('/api/app/darwin-aarch64/0.1.1')
assert.equal(tauriManifestResponse.statusCode, 200)
const tauriManifest = tauriManifestResponse.json()
assert.equal(tauriManifest.version, '0.1.2')
assert.equal(tauriManifest.notes, 'Smoke update')
assert.equal(tauriManifest.pub_date, '2026-04-26T00:00:00Z')
assert.equal(tauriManifest.platforms['darwin-aarch64'].signature, 'smoke-signature')
assert.equal(tauriManifest.platforms['darwin-aarch64'].url, `http://127.0.0.1:18111/api/app/download/${artifactName}`)

const currentResponse = await app.inject('/api/app/darwin-aarch64/0.1.2')
assert.equal(currentResponse.statusCode, 204)

process.env.HANASAND_APP_VERSION = 'ab6241d'
const hashManifestResponse = await app.inject('/api/app?platform=macos&version=0.0.0')
assert.equal(hashManifestResponse.statusCode, 200)
assert.equal(hashManifestResponse.json().update_available, true)

const hashCurrentResponse = await app.inject('/api/app/darwin-aarch64/ab6241d')
assert.equal(hashCurrentResponse.statusCode, 204)
delete process.env.HANASAND_APP_VERSION

const downloadResponse = await app.inject(`/api/app/download/${artifactName}`)
assert.equal(downloadResponse.statusCode, 200)
assert.equal(downloadResponse.body, artifactBody)
assert.equal(downloadResponse.headers['x-hanasand-app-version'], '0.1.2')

const traversalResponse = await app.inject('/api/app/download/..%2Fsecret.zip')
assert.equal(traversalResponse.statusCode, 400)

await app.close()

console.log('App update smoke passed for latest.json manifests and named downloads.')
