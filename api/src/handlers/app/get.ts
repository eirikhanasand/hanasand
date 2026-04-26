import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'

const currentApiBase = process.env.HANASAND_APP_API_BASE || 'https://hanasand.com/api'
const defaultVersion = '0.1.1'
const defaultUpdateDirectory = '/srv/hanasand/app-updates'

type DesktopUpdateManifest = {
    version?: string
    package?: string
    notes?: string
    channel?: string
    released_at?: string
    releasedAt?: string
}

type TauriUpdateManifest = {
    version?: string
    notes?: string
    pub_date?: string
    platforms?: Record<string, {
        signature?: string
        url?: string
    }>
}

type AppQuery = {
    platform?: string
    version?: string
}

type AppDownloadQuery = {
    platform?: string
}

type TauriUpdateParams = {
    target: string
    version: string
}

type TauriDownloadParams = {
    name: string
}

function updateDirectory() {
    return process.env.HANASAND_APP_UPDATE_DIR || defaultUpdateDirectory
}

async function readUpdateManifest() {
    const manifestPath = path.join(updateDirectory(), 'manifest.json')
    const data = await readFile(manifestPath, 'utf8')
    return JSON.parse(data) as DesktopUpdateManifest
}

async function readTauriUpdateManifest() {
    const manifestPath = path.join(updateDirectory(), 'latest.json')
    const data = await readFile(manifestPath, 'utf8')
    return JSON.parse(data) as TauriUpdateManifest
}

async function configuredUpdate() {
    const [manifest, tauriManifest] = await Promise.all([
        readUpdateManifest().catch(() => null),
        readTauriUpdateManifest().catch(() => null),
    ])
    const manifestPackage = manifest?.package
        ? path.resolve(updateDirectory(), manifest.package)
        : ''
    const tauriPackage = firstTauriPackagePath(tauriManifest)
    const filePath = process.env.HANASAND_APP_UPDATE_FILE || manifestPackage || tauriPackage
    const file = await fileMetadata(filePath).catch(() => null)
    const version = process.env.HANASAND_APP_VERSION || manifest?.version || tauriManifest?.version || defaultVersion

    return {
        file,
        version,
        channel: process.env.HANASAND_APP_CHANNEL || manifest?.channel || 'stable',
        releasedAt: process.env.HANASAND_APP_RELEASED_AT || manifest?.released_at || manifest?.releasedAt || tauriManifest?.pub_date || new Date().toISOString(),
        notes: process.env.HANASAND_APP_RELEASE_NOTES || manifest?.notes || tauriManifest?.notes || 'Desktop app update from the Hanasand API.',
        tauriManifest,
    }
}

function firstTauriPackagePath(manifest: TauriUpdateManifest | null) {
    const platforms = manifest?.platforms
    if (!platforms) return ''

    for (const platform of Object.values(platforms)) {
        const packageName = packageNameFromURL(platform.url)
        if (packageName) {
            return path.resolve(updateDirectory(), packageName)
        }
    }

    return ''
}

function packageNameFromURL(rawURL?: string) {
    if (!rawURL) return ''
    try {
        return path.basename(new URL(rawURL).pathname)
    } catch {
        return path.basename(rawURL)
    }
}

function normalizePlatform(platform?: string) {
    return platform?.trim().toLowerCase() || 'macos'
}

function compareVersions(a: string, b: string) {
    const left = a.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0)
    const right = b.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0)
    const length = Math.max(left.length, right.length)
    for (let index = 0; index < length; index += 1) {
        const diff = (left[index] || 0) - (right[index] || 0)
        if (diff !== 0) return diff
    }
    return 0
}

async function fileMetadata(filePath: string) {
    if (!filePath) return null
    const absolute = path.resolve(filePath)
    const [info, bytes] = await Promise.all([
        stat(absolute),
        readFile(absolute),
    ])

    return {
        absolute,
        size: info.size,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    }
}

function publicBaseURL() {
    return currentApiBase.replace(/\/$/, '')
}

export async function getAppUpdate(req: FastifyRequest<{ Querystring: AppQuery }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const platform = normalizePlatform(req.query.platform)
    const installedVersion = req.query.version || '0.0.0'
    const update = await configuredUpdate()
    const version = update.version
    const file = update.file
    const updateAvailable = Boolean(file) && compareVersions(version, installedVersion) > 0

    return res.send({
        app: 'hanasand-desktop',
        platform,
        installed_version: installedVersion,
        latest_version: version,
        update_available: updateAvailable,
        channel: update.channel,
        released_at: update.releasedAt,
        notes: update.notes,
        download_url: `${publicBaseURL()}/app/download?platform=${encodeURIComponent(platform)}`,
        package_size: file?.size || null,
        sha256: file?.sha256 || null,
    })
}

export async function getTauriAppUpdate(req: FastifyRequest<{ Params: TauriUpdateParams }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const target = req.params.target || 'darwin-aarch64'
    const installedVersion = req.params.version || '0.0.0'
    const update = await configuredUpdate()
    const version = update.version
    const file = update.file

    if (!file || compareVersions(version, installedVersion) <= 0) {
        return res.status(204).send()
    }

    const artifactName = path.basename(file.absolute)
    const platformManifest = update.tauriManifest?.platforms?.[target] || firstTauriPlatform(update.tauriManifest)
    return res.send({
        version,
        notes: update.notes,
        pub_date: update.releasedAt,
        platforms: {
            [target]: {
                signature: process.env.HANASAND_APP_UPDATE_SIGNATURE || platformManifest?.signature || '',
                url: `${publicBaseURL()}/app/download/${encodeURIComponent(artifactName)}`,
            },
        },
    })
}

function firstTauriPlatform(manifest?: TauriUpdateManifest | null) {
    const platforms = manifest?.platforms
    if (!platforms) return null
    return Object.values(platforms)[0] || null
}

export async function downloadAppUpdate(req: FastifyRequest<{ Querystring: AppDownloadQuery }>, res: FastifyReply) {
    const platform = normalizePlatform(req.query.platform)
    return sendAppUpdatePackage(res, platform)
}

export async function downloadNamedAppUpdate(req: FastifyRequest<{ Params: TauriDownloadParams }>, res: FastifyReply) {
    return sendNamedAppUpdatePackage(res, req.params.name)
}

async function sendAppUpdatePackage(res: FastifyReply, platform: string) {
    const update = await configuredUpdate()
    const file = update.file

    if (!file) {
        return res.status(404).send({
            error: 'No app update package is configured.',
            hint: `Upload manifest.json and the package to ${updateDirectory()}, or set HANASAND_APP_UPDATE_FILE to a readable dmg, zip, or pkg.`,
        })
    }

    const filename = path.basename(file.absolute)
    res.header('Content-Type', 'application/octet-stream')
    res.header('Cache-Control', 'no-store')
    res.header('Content-Length', String(file.size))
    res.header('Content-Disposition', `attachment; filename="${filename}"`)
    res.header('X-Hanasand-App-Platform', platform)
    res.header('X-Hanasand-App-Version', update.version)
    res.header('X-Hanasand-App-Sha256', file.sha256)

    return res.send(createReadStream(file.absolute))
}

async function sendNamedAppUpdatePackage(res: FastifyReply, name: string) {
    const safeName = path.basename(name || '')
    if (!safeName || safeName !== name) {
        return res.status(400).send({ error: 'Invalid app update package name.' })
    }

    const file = await fileMetadata(path.resolve(updateDirectory(), safeName)).catch(() => null)
    if (!file) {
        return res.status(404).send({ error: 'App update package was not found.' })
    }

    const update = await configuredUpdate()
    res.header('Content-Type', 'application/octet-stream')
    res.header('Cache-Control', 'no-store')
    res.header('Content-Length', String(file.size))
    res.header('Content-Disposition', `attachment; filename="${safeName}"`)
    res.header('X-Hanasand-App-Platform', 'macos')
    res.header('X-Hanasand-App-Version', update.version)
    res.header('X-Hanasand-App-Sha256', file.sha256)

    return res.send(createReadStream(file.absolute))
}
