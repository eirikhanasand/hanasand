import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { runTrackedBackgroundJob } from '../backgroundJobRuntime.ts'
import { listRuntimeContainers } from '../docker/engine.ts'

const execFileAsync = promisify(execFile)

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'
export type SeverityCount = Record<SeverityLevel, number>

export type VulnerabilityDetail = {
    id: string
    title: string
    severity: SeverityLevel
    source: string
    packageName: string | null
    packageType: string | null
    installedVersion: string | null
    fixedVersion: string | null
    description: string | null
    references: string[]
}

export type ImageVulnerabilityReport = {
    image: string
    scannedAt: string
    totalVulnerabilities: number
    severity: SeverityCount
    groups: Array<{ source: string, total: number, severity: SeverityCount }>
    vulnerabilities: VulnerabilityDetail[]
    scanError: string | null
}

export type VulnerabilityScanLog = {
    at: string
    level: 'info' | 'warn' | 'error'
    message: string
}

export type DockerScoutScanStatus = {
    isRunning: boolean
    startedAt: string | null
    finishedAt: string | null
    lastSuccessAt: string | null
    lastError: string | null
    totalImages: number | null
    completedImages: number
    currentImage: string | null
    estimatedCompletionAt: string | null
    enabled: boolean
    paused: boolean
    schedule: string
    cadenceSeconds: number
    nextRunAt: string | null
    targetCount: number
    failureCount: number
    stale: boolean
    staleReason: string | null
    blocker: string | null
    blockerAction: string | null
    logs: VulnerabilityScanLog[]
}

export type VulnerabilityReport = {
    generatedAt: string | null
    imageCount: number
    images: ImageVulnerabilityReport[]
    scanStatus: DockerScoutScanStatus
}

type StoredScannerState = VulnerabilityReport & {
    paused: boolean
    failureCount: number
    nextRunAt: string | null
    logs: VulnerabilityScanLog[]
}

const SCAN_JOB_ID = 'api-vulnerability-scanner'
export const VULNERABILITY_SCAN_JOB_ID = SCAN_JOB_ID
export const VULNERABILITY_SCAN_CADENCE_SECONDS = Number(process.env.VULNERABILITY_SCAN_INTERVAL_SECONDS || 3600)
const STALE_AFTER_MS = Number(process.env.VULNERABILITY_SCAN_STALE_AFTER_SECONDS || VULNERABILITY_SCAN_CADENCE_SECONDS * 2) * 1000
const STATE_PATH = process.env.VULNERABILITY_SCAN_STATE_PATH || '/var/lib/hanasand/vulnerability-scan.json'
const DEFAULT_LOGS: VulnerabilityScanLog[] = [{
    at: new Date(0).toISOString(),
    level: 'info',
    message: '[vuln] Vulnerability scanner state initialized; waiting for the first scheduled scan.',
}]

let activeScan: Promise<VulnerabilityReport> | null = null

export async function getVulnerabilityReport(): Promise<VulnerabilityReport> {
    const [state, targetCount] = await Promise.all([
        readState(),
        discoverTargetImages().then(images => images.length).catch(() => 0),
    ])

    return withDerivedStatus({
        ...state,
        imageCount: state.images.length,
        scanStatus: {
            ...state.scanStatus,
            targetCount,
        },
    })
}

export async function runDueVulnerabilityScan() {
    const state = await readState()
    if (state.paused || state.scanStatus.isRunning) return withDerivedStatus(state)

    const nextRunAt = state.nextRunAt ? new Date(state.nextRunAt).getTime() : 0
    if (Number.isFinite(nextRunAt) && nextRunAt > Date.now()) {
        return withDerivedStatus(state)
    }

    return runVulnerabilityScan()
}

export async function runVulnerabilityScan(): Promise<VulnerabilityReport> {
    if (activeScan) return activeScan

    activeScan = runVulnerabilityScanInternal().finally(() => {
        activeScan = null
    })

    return activeScan
}

export function startTrackedVulnerabilityScan() {
    return runTrackedBackgroundJob(VULNERABILITY_SCAN_JOB_ID, runVulnerabilityScan)
}

export function isVulnerabilityScanActive() {
    return Boolean(activeScan)
}

export async function setVulnerabilityScannerPaused(paused: boolean) {
    const state = await readState()
    const nextRunAt = paused ? null : nextScheduledAt(new Date())
    const next = await persistState({
        ...state,
        paused,
        nextRunAt,
        scanStatus: {
            ...state.scanStatus,
            enabled: !paused,
            paused,
            nextRunAt,
        },
        logs: appendLog(state.logs, 'info', paused
            ? '[vuln] Vulnerability scanner paused from Cron Jobs dashboard.'
            : '[vuln] Vulnerability scanner resumed from Cron Jobs dashboard.'),
    })
    return withDerivedStatus(next)
}

async function runVulnerabilityScanInternal(): Promise<VulnerabilityReport> {
    const startedAt = new Date()
    const previous = await readState()
    const startedState = await persistState({
        ...previous,
        scanStatus: {
            ...previous.scanStatus,
            isRunning: true,
            startedAt: startedAt.toISOString(),
            finishedAt: null,
            lastError: null,
            totalImages: null,
            completedImages: 0,
            currentImage: null,
            estimatedCompletionAt: null,
            stale: false,
            staleReason: null,
            blocker: null,
            blockerAction: null,
        },
        logs: appendLog(previous.logs, 'info', '[vuln] Vulnerability scanning is enabled; discovering running container images.'),
    })

    let targets: string[]
    try {
        targets = await discoverTargetImages()
    } catch (error) {
        return finishScan(startedState, [], errorMessage(error), 'Mount /var/run/docker.sock into the API container and verify Docker API access.')
    }

    if (!targets.length) {
        return finishScan(startedState, [], null, null, '[vuln] No running container images were discovered for vulnerability scanning.')
    }

    const reports: ImageVulnerabilityReport[] = []
    let currentState = startedState
    for (const [index, image] of targets.entries()) {
        currentState = await persistState({
            ...currentState,
            scanStatus: {
                ...currentState.scanStatus,
                totalImages: targets.length,
                completedImages: index,
                currentImage: image,
                estimatedCompletionAt: estimateCompletion(startedAt, index, targets.length),
            },
        })
        reports.push(await scanImage(image))
    }

    const failed = reports.filter(report => report.scanError).length
    const blocker = failed === reports.length
        ? reports[0]?.scanError || 'Every image scan failed.'
        : null
    const blockerAction = blocker
        ? 'Install Docker CLI with the Scout plugin in the API container, or configure a supported image scanner service.'
        : null

    return finishScan(currentState, reports, blocker, blockerAction)
}

async function finishScan(
    state: StoredScannerState,
    images: ImageVulnerabilityReport[],
    blocker: string | null,
    blockerAction: string | null,
    successLog = '[vuln] Vulnerability scan completed.'
) {
    const finishedAt = new Date().toISOString()
    const isFailure = Boolean(blocker)
    const next = await persistState({
        ...state,
        generatedAt: finishedAt,
        images,
        imageCount: images.length,
        failureCount: state.failureCount + (isFailure ? 1 : 0),
        nextRunAt: state.paused ? null : nextScheduledAt(new Date()),
        scanStatus: {
            ...state.scanStatus,
            isRunning: false,
            finishedAt,
            lastSuccessAt: isFailure ? state.scanStatus.lastSuccessAt : finishedAt,
            lastError: blocker,
            totalImages: images.length,
            completedImages: images.length,
            currentImage: null,
            estimatedCompletionAt: null,
            targetCount: images.length,
            failureCount: state.failureCount + (isFailure ? 1 : 0),
            blocker,
            blockerAction,
        },
        logs: appendLog(state.logs, isFailure ? 'error' : 'info', blocker || successLog),
    })
    return withDerivedStatus(next)
}

async function scanImage(image: string): Promise<ImageVulnerabilityReport> {
    const scannedAt = new Date().toISOString()
    try {
        const { stdout } = await execFileAsync('docker', ['scout', 'cves', '--format', 'sarif', image], {
            timeout: Number(process.env.VULNERABILITY_SCAN_IMAGE_TIMEOUT_MS || 120000),
            maxBuffer: 8 * 1024 * 1024,
        })
        const vulnerabilities = parseSarif(stdout)
        return {
            image,
            scannedAt,
            totalVulnerabilities: vulnerabilities.length,
            severity: countSeverity(vulnerabilities),
            groups: groupFindings(vulnerabilities),
            vulnerabilities,
            scanError: null,
        }
    } catch (error) {
        return emptyImageReport(image, scannedAt, dockerScoutError(error))
    }
}

async function discoverTargetImages() {
    const containers = await listRuntimeContainers()
    return [...new Set(containers
        .filter(container => container.state === 'running')
        .map(container => container.image)
        .filter(image => image && image !== '<none>' && image !== 'unknown'))]
        .sort()
}

function parseSarif(raw: string): VulnerabilityDetail[] {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const runs = Array.isArray(parsed.runs) ? parsed.runs as Array<Record<string, unknown>> : []
    const details: VulnerabilityDetail[] = []

    for (const run of runs) {
        const tool = record(record(run.tool).driver)
        const rules = new Map((Array.isArray(tool.rules) ? tool.rules as Array<Record<string, unknown>> : [])
            .map(rule => [String(rule.id || 'unknown'), rule]))
        for (const result of Array.isArray(run.results) ? run.results as Array<Record<string, unknown>> : []) {
            const id = String(result.ruleId || 'unknown')
            const rule = rules.get(id) || {}
            const properties = record({ ...record(rule.properties), ...record(result.properties) })
            const message = stringValue(record(result.message).text)
            details.push({
                id,
                title: stringValue(record(rule.shortDescription).text) || message || id,
                severity: normalizeSeverity(stringValue(properties.severity || properties['security-severity'] || record(result.level).text) || stringValue(result.level)),
                source: stringValue(tool.name) || 'Docker Scout',
                packageName: stringValue(properties.packageName || properties.package || properties.purl),
                packageType: stringValue(properties.packageType || properties.ecosystem),
                installedVersion: stringValue(properties.installedVersion || properties.version),
                fixedVersion: stringValue(properties.fixedVersion || properties.fixed_version),
                description: stringValue(record(rule.fullDescription).text) || message,
                references: arrayOfStrings(properties.references),
            })
        }
    }

    return dedupeFindings(details)
}

function emptyImageReport(image: string, scannedAt: string, scanError: string): ImageVulnerabilityReport {
    return {
        image,
        scannedAt,
        totalVulnerabilities: 0,
        severity: emptySeverity(),
        groups: [],
        vulnerabilities: [],
        scanError,
    }
}

function dockerScoutError(error: unknown) {
    const message = errorMessage(error)
    if (/ENOENT|not found|executable file/i.test(message)) {
        return 'Docker CLI or Docker Scout is unavailable in the API container.'
    }
    if (/unknown command.*scout|docker:.*scout/i.test(message)) {
        return 'Docker CLI is installed but the Docker Scout plugin is unavailable.'
    }
    if (/permission denied|connect: permission/i.test(message)) {
        return 'Docker socket permission denied for the API container.'
    }
    return message
}

function withDerivedStatus(state: StoredScannerState): VulnerabilityReport {
    const status = state.scanStatus
    const lastFinishedAt = status.finishedAt || latestImageScanAt(state.images)
    const staleReason = computeStaleReason(state, lastFinishedAt)
    const generatedAt = state.generatedAt || lastFinishedAt

    return {
        generatedAt,
        imageCount: state.images.length,
        images: state.images,
        scanStatus: {
            ...status,
            enabled: !state.paused,
            paused: state.paused,
            schedule: secondsSchedule(VULNERABILITY_SCAN_CADENCE_SECONDS),
            cadenceSeconds: VULNERABILITY_SCAN_CADENCE_SECONDS,
            nextRunAt: state.paused ? null : state.nextRunAt || nextScheduledAt(new Date()),
            failureCount: state.failureCount,
            stale: Boolean(staleReason),
            staleReason,
            logs: state.logs,
        },
    }
}

async function readState(): Promise<StoredScannerState> {
    if (existsSync(STATE_PATH)) {
        try {
            return normalizeState(JSON.parse(await readFile(STATE_PATH, 'utf8')))
        } catch {
            // Fall through to a clean state; the next write repairs the file.
        }
    }
    return normalizeState({})
}

async function persistState(state: StoredScannerState) {
    const normalized = normalizeState(state)
    await mkdir(path.dirname(STATE_PATH), { recursive: true })
    await writeFile(STATE_PATH, JSON.stringify(normalized, null, 2), 'utf8')
    return normalized
}

function normalizeState(value: unknown): StoredScannerState {
    const input = record(value)
    const scanStatus = record(input.scanStatus)
    const paused = typeof input.paused === 'boolean'
        ? input.paused
        : Boolean(scanStatus.paused)
    const storedNextRunAt = stringValue(input.nextRunAt ?? scanStatus.nextRunAt)
    const nextRunAt = storedNextRunAt || new Date().toISOString()
    const storedRunning = Boolean(scanStatus.isRunning)
    const interrupted = storedRunning && !activeScan
    const interruptedMessage = 'Previous vulnerability scan was interrupted before completion.'
    const logs = normalizeLogs(input.logs ?? scanStatus.logs)
    const repairedLogs = interrupted && !logs.some(log => log.message === interruptedMessage)
        ? appendLog(logs, 'error', interruptedMessage)
        : logs
    return {
        generatedAt: stringValue(input.generatedAt),
        imageCount: Array.isArray(input.images) ? input.images.length : 0,
        images: Array.isArray(input.images) ? input.images.map(normalizeImageReport) : [],
        paused,
        failureCount: numberValue(input.failureCount ?? scanStatus.failureCount) || 0,
        nextRunAt,
        logs: repairedLogs,
        scanStatus: {
            isRunning: storedRunning && !interrupted,
            startedAt: stringValue(scanStatus.startedAt),
            finishedAt: stringValue(scanStatus.finishedAt),
            lastSuccessAt: stringValue(scanStatus.lastSuccessAt),
            lastError: interrupted ? interruptedMessage : stringValue(scanStatus.lastError),
            totalImages: numberValue(scanStatus.totalImages),
            completedImages: numberValue(scanStatus.completedImages) || 0,
            currentImage: interrupted ? null : stringValue(scanStatus.currentImage),
            estimatedCompletionAt: interrupted ? null : stringValue(scanStatus.estimatedCompletionAt),
            enabled: !paused,
            paused,
            schedule: secondsSchedule(VULNERABILITY_SCAN_CADENCE_SECONDS),
            cadenceSeconds: VULNERABILITY_SCAN_CADENCE_SECONDS,
            nextRunAt,
            targetCount: numberValue(scanStatus.targetCount) || 0,
            failureCount: numberValue(input.failureCount ?? scanStatus.failureCount) || 0,
            stale: false,
            staleReason: null,
            blocker: interrupted ? interruptedMessage : stringValue(scanStatus.blocker),
            blockerAction: interrupted
                ? 'Run the scan again from Vulnerabilities or Cron Jobs; check API restarts if this repeats.'
                : stringValue(scanStatus.blockerAction),
            logs: repairedLogs,
        },
    }
}

function normalizeImageReport(input: unknown): ImageVulnerabilityReport {
    const image = record(input)
    return {
        image: stringValue(image.image) || 'unknown',
        scannedAt: stringValue(image.scannedAt) || '',
        totalVulnerabilities: numberValue(image.totalVulnerabilities) || 0,
        severity: normalizeSeverityCount(image.severity),
        groups: Array.isArray(image.groups) ? image.groups.map(group => {
            const item = record(group)
            return {
                source: stringValue(item.source) || 'unknown',
                total: numberValue(item.total) || 0,
                severity: normalizeSeverityCount(item.severity),
            }
        }) : [],
        vulnerabilities: Array.isArray(image.vulnerabilities) ? image.vulnerabilities.map(normalizeVulnerability) : [],
        scanError: stringValue(image.scanError),
    }
}

function normalizeVulnerability(input: unknown): VulnerabilityDetail {
    const item = record(input)
    return {
        id: stringValue(item.id) || 'unknown',
        title: stringValue(item.title) || 'Untitled finding',
        severity: normalizeSeverity(stringValue(item.severity)),
        source: stringValue(item.source) || 'unknown',
        packageName: stringValue(item.packageName),
        packageType: stringValue(item.packageType),
        installedVersion: stringValue(item.installedVersion),
        fixedVersion: stringValue(item.fixedVersion),
        description: stringValue(item.description),
        references: arrayOfStrings(item.references),
    }
}

function normalizeLogs(value: unknown) {
    const logs = Array.isArray(value) ? value.map(log => {
        const item = record(log)
        return {
            at: stringValue(item.at) || new Date().toISOString(),
            level: normalizeLogLevel(stringValue(item.level)),
            message: stringValue(item.message) || '',
        }
    }).filter(log => log.message) : DEFAULT_LOGS
    return logs.slice(-8)
}

function appendLog(logs: VulnerabilityScanLog[], level: VulnerabilityScanLog['level'], message: string) {
    return [...logs, { at: new Date().toISOString(), level, message }].slice(-8)
}

function computeStaleReason(state: StoredScannerState, lastFinishedAt: string | null) {
    if (state.scanStatus.isRunning) return null
    if (state.paused) return 'Scanner is paused from Cron Jobs.'
    if (state.scanStatus.blocker || state.scanStatus.lastError) return state.scanStatus.blocker || state.scanStatus.lastError
    if (!lastFinishedAt) return 'No vulnerability scan has completed yet.'
    if (Date.now() - new Date(lastFinishedAt).getTime() > STALE_AFTER_MS) {
        return `Last completed scan is older than ${secondsSchedule(Math.round(STALE_AFTER_MS / 1000))}.`
    }
    return null
}

function latestImageScanAt(images: ImageVulnerabilityReport[]) {
    const timestamps = images.map(image => new Date(image.scannedAt).getTime()).filter(Number.isFinite)
    if (!timestamps.length) return null
    return new Date(Math.max(...timestamps)).toISOString()
}

function nextScheduledAt(from: Date) {
    return new Date(from.getTime() + VULNERABILITY_SCAN_CADENCE_SECONDS * 1000).toISOString()
}

function estimateCompletion(startedAt: Date, completed: number, total: number) {
    if (completed <= 0 || total <= completed) return null
    const elapsed = Date.now() - startedAt.getTime()
    const perImage = elapsed / completed
    return new Date(Date.now() + perImage * (total - completed)).toISOString()
}

function countSeverity(vulnerabilities: VulnerabilityDetail[]) {
    const count = emptySeverity()
    for (const vulnerability of vulnerabilities) count[vulnerability.severity] += 1
    return count
}

function groupFindings(vulnerabilities: VulnerabilityDetail[]) {
    const groups = new Map<string, VulnerabilityDetail[]>()
    for (const vulnerability of vulnerabilities) {
        const key = vulnerability.source || 'unknown'
        groups.set(key, [...(groups.get(key) || []), vulnerability])
    }
    return [...groups.entries()].map(([source, findings]) => ({
        source,
        total: findings.length,
        severity: countSeverity(findings),
    }))
}

function dedupeFindings(findings: VulnerabilityDetail[]) {
    const seen = new Set<string>()
    return findings.filter(finding => {
        const key = `${finding.id}:${finding.packageName || ''}:${finding.installedVersion || ''}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function normalizeSeverity(value: string | null): SeverityLevel {
    const normalized = (value || '').toLowerCase()
    if (normalized.includes('critical')) return 'critical'
    if (normalized.includes('high') || Number(normalized) >= 7) return 'high'
    if (normalized.includes('medium') || Number(normalized) >= 4) return 'medium'
    if (normalized.includes('low') || Number(normalized) > 0) return 'low'
    return 'unknown'
}

function normalizeSeverityCount(value: unknown): SeverityCount {
    const input = record(value)
    return {
        critical: numberValue(input.critical) || 0,
        high: numberValue(input.high) || 0,
        medium: numberValue(input.medium) || 0,
        low: numberValue(input.low) || 0,
        unknown: numberValue(input.unknown) || 0,
    }
}

function emptySeverity(): SeverityCount {
    return { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
}

function secondsSchedule(seconds: number) {
    if (seconds % 3600 === 0) return `Every ${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`
    if (seconds % 60 === 0) return `Every ${seconds / 60} minute${seconds === 60 ? '' : 's'}`
    return `Every ${seconds} seconds`
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(value: unknown) {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    return Number.isFinite(number) ? number : null
}

function arrayOfStrings(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeLogLevel(value: string | null): VulnerabilityScanLog['level'] {
    if (value === 'error' || value === 'warn' || value === 'info') return value
    return 'info'
}

function errorMessage(error: unknown) {
    if (error instanceof Error) {
        const output = record(error)
        const stderr = stringValue(output.stderr)
        const stdout = stringValue(output.stdout)
        return stderr || stdout || error.message
    }
    return String(error)
}
