import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'

const currentApiBase = process.env.HANASAND_APP_API_BASE || 'https://hanasand.com/api'
const defaultVersion = '0.1.1'

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

function updateFilePath() {
    return process.env.HANASAND_APP_UPDATE_FILE || ''
}

function latestVersion() {
    return process.env.HANASAND_APP_VERSION || defaultVersion
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
    const platform = normalizePlatform(req.query.platform)
    const installedVersion = req.query.version || '0.0.0'
    const version = latestVersion()
    const file = await fileMetadata(updateFilePath()).catch(() => null)
    const updateAvailable = Boolean(file) && compareVersions(version, installedVersion) > 0

    return res.send({
        app: 'hanasand-desktop',
        platform,
        installed_version: installedVersion,
        latest_version: version,
        update_available: updateAvailable,
        channel: process.env.HANASAND_APP_CHANNEL || 'stable',
        released_at: process.env.HANASAND_APP_RELEASED_AT || new Date().toISOString(),
        notes: process.env.HANASAND_APP_RELEASE_NOTES || 'Desktop app update from the Hanasand API.',
        download_url: `${publicBaseURL()}/app/download?platform=${encodeURIComponent(platform)}`,
        package_size: file?.size || null,
        sha256: file?.sha256 || null,
    })
}

export async function getTauriAppUpdate(req: FastifyRequest<{ Params: TauriUpdateParams }>, res: FastifyReply) {
    const target = req.params.target || 'darwin-aarch64'
    const installedVersion = req.params.version || '0.0.0'
    const version = latestVersion()
    const file = await fileMetadata(updateFilePath()).catch(() => null)

    if (!file || compareVersions(version, installedVersion) <= 0) {
        return res.status(204).send()
    }

    const artifactName = path.basename(file.absolute)
    return res.send({
        version,
        notes: process.env.HANASAND_APP_RELEASE_NOTES || 'Desktop app update from the Hanasand API.',
        pub_date: process.env.HANASAND_APP_RELEASED_AT || new Date().toISOString(),
        platforms: {
            [target]: {
                signature: process.env.HANASAND_APP_UPDATE_SIGNATURE || '',
                url: `${publicBaseURL()}/app/download/${encodeURIComponent(artifactName)}`,
            },
        },
    })
}

export async function downloadAppUpdate(req: FastifyRequest<{ Querystring: AppDownloadQuery }>, res: FastifyReply) {
    const platform = normalizePlatform(req.query.platform)
    return sendAppUpdatePackage(res, platform)
}

export async function downloadNamedAppUpdate(req: FastifyRequest<{ Params: TauriDownloadParams }>, res: FastifyReply) {
    void req
    return sendAppUpdatePackage(res, 'macos')
}

async function sendAppUpdatePackage(res: FastifyReply, platform: string) {
    const file = await fileMetadata(updateFilePath()).catch(() => null)

    if (!file) {
        return res.status(404).send({
            error: 'No app update package is configured.',
            hint: 'Set HANASAND_APP_UPDATE_FILE to a readable dmg, zip, or pkg before serving downloads.',
        })
    }

    const filename = path.basename(file.absolute)
    res.header('Content-Type', 'application/octet-stream')
    res.header('Content-Length', String(file.size))
    res.header('Content-Disposition', `attachment; filename="${filename}"`)
    res.header('X-Hanasand-App-Platform', platform)
    res.header('X-Hanasand-App-Version', latestVersion())
    res.header('X-Hanasand-App-Sha256', file.sha256)

    return res.send(createReadStream(file.absolute))
}
