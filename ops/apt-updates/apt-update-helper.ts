import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

/** @typedef {{package: string, version: string, repo: string, origin: string, security: boolean, first_seen: number, installed_at: number}} Update */

/** @param {string} out @param {string} oldText @param {string} now @param {string} runId */
export function failedRefreshStatus(out, oldText, now, runId) {
    const data = JSON.parse(oldText)
    Object.assign(data, {
        schema_version: 1,
        host: 'hanasand',
        run_id: runId,
        checked_at: now,
        status: 'failed',
        last_error: 'apt-get update failed; no packages were installed.',
        installed_packages: [],
        policy: {
            non_security_delay_hours: 72,
            security_install: 'immediate',
            allowed_origin: 'Ubuntu noble/noble-updates/noble-security',
        },
    })
    writeJson(out, data)
}

/** @param {string} trackPath @param {string} simulationPath @param {string} planPath @param {number} now
 *  @param {(packageName: string, now: number) => number} [getInstalledAt] */
export function createPlan(trackPath, simulationPath, planPath, now, getInstalledAt = installedAt) {
    const old = new Map()
    for (const line of readFileSync(trackPath, 'utf8').split(/\r?\n/)) {
        const parts = line.split('\t')
        if (parts.length >= 5) old.set(`${parts[0]}\t${parts[1]}`, {
            first_seen: Number(parts[2]), security: parts[3] === 'security', origin: parts[4],
        })
    }

    /** @type {Update[]} */
    const updates = []
    for (const line of readFileSync(simulationPath, 'utf8').split(/\r?\n/)) {
        // Ubuntu 24.04 emits: Inst pkg [installed] (candidate Ubuntu:24.04/noble-updates [amd64])
        const match = line.match(/^Inst\s+(\S+)(?:\s+\[[^\]]+\])?\s+\((\S+)\s+([^\s\[]+)(?:\s+\[[^\]]+\])?\)/)
        if (!match) continue
        const [, packageName, version, repo] = match
        const origin = repo.split(':', 1)[0]
        const security = repo.toLowerCase().includes('noble-security') && origin.toLowerCase() === 'ubuntu'
        const prior = old.get(`${packageName}\t${version}`)
        updates.push({
            package: packageName,
            version,
            repo,
            origin: origin.trim(),
            security,
            first_seen: prior?.first_seen ?? now,
            installed_at: getInstalledAt(packageName, now),
        })
    }

    writeFileSync(trackPath, updates.map(update =>
        `${update.package}\t${update.version}\t${update.first_seen}\t${update.security ? 'security' : 'regular'}\t${update.origin}\n`,
    ).join(''))
    writeJson(planPath, { updates })
}

/** @param {string} planPath @param {number} now @param {'security' | 'regular'} kind */
export function packageBatch(planPath, now, kind) {
    /** @type {{updates: Update[]}} */
    const { updates } = JSON.parse(readFileSync(planPath, 'utf8'))
    return updates.filter(update => update.origin.toLowerCase() === 'ubuntu' &&
        (kind === 'security' ? update.security : !update.security && now - update.installed_at >= 72 * 60 * 60))
        .map(update => update.package).join(' ')
}

/** @param {string} out @param {string} planPath @param {string} oldText @param {string} now @param {string} runId
 *  @param {string} installedText @param {string} errorsText @param {(update: Update) => boolean} [isInstalled] */
export function collectStatus(out, planPath, oldText, now, runId, installedText, errorsText, isInstalled = candidateIsInstalled) {
    /** @type {{updates: Update[]}} */
    const { updates } = JSON.parse(readFileSync(planPath, 'utf8'))
    const old = JSON.parse(oldText)
    const installed = installedText ? installedText.split(/\s+/) : []
    const errors = errorsText ? errorsText.split('|') : []
    const installedUpdates = updates
        .filter(update => isInstalled(update))
        .map(update => ({ package: update.package, version: update.version }))
    const installedNames = new Set(installedUpdates.map(update => update.package))
    const remaining = updates.filter(update => !installedNames.has(update.package))
    const failureDetails = errors.map(error => error.replace(/^Failed to install /, ''))

    writeJson(out, {
        schema_version: 1,
        host: 'hanasand',
        run_id: runId,
        checked_at: now,
        status: errors.length ? 'failed' : remaining.length ? 'pending' : 'ok',
        last_error: failureDetails.length ? `Failed to install ${failureDetails.join(' and ')}` : null,
        pending_updates: remaining,
        installed_packages: installedUpdates,
        last_updated_packages: installed.length ? installed : old.last_updated_packages || [],
        last_update_at: installed.length ? now : old.last_update_at ?? null,
        policy: {
            non_security_delay_hours: 72,
            security_install: 'immediate',
            allowed_origin: 'Ubuntu noble/noble-updates/noble-security',
            repository_verification: 'APT Release-file signatures and Ubuntu origin allowlist',
        },
    })
}

/** @param {string} packageName @param {number} now */
function installedAt(packageName, now) {
    try {
        return Number(execFileSync('stat', ['-c', '%Y', `/var/lib/dpkg/info/${packageName}.list`], { encoding: 'utf8' }).trim())
    } catch {
        return now
    }
}

/** @param {Update} update */
function candidateIsInstalled(update) {
    try {
        const actual = execFileSync('dpkg-query', ['-W', '-f=${Status}\t${Version}', update.package], { encoding: 'utf8' }).trim()
        return actual === `install ok installed\t${update.version}`
    } catch {
        return false
    }
}

/** @param {string} path @param {unknown} data */
function writeJson(path, data) {
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

/** @param {string} mode @param {string[]} args */
function runMode(mode, args) {
    if (mode === 'failed-refresh') return failedRefreshStatus(args[0], args[1], args[2], args[3])
    if (mode === 'plan') return createPlan(args[0], args[1], args[2], Number(args[3]))
    if (mode === 'packages') return process.stdout.write(`${packageBatch(args[0], Number(args[1]), args[2])}\n`)
    if (mode === 'collect-status') return collectStatus(args[0], args[1], args[2], args[3], args[4], args[5], args[6])
    throw new Error(`Unknown apt update helper mode: ${mode}`)
}

if (process.argv[1]?.endsWith('/apt-update-helper.ts') || process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/apt-update-helper.ts')) {
    const [mode, ...args] = process.argv.slice(2)
    runMode(mode, args)
}
