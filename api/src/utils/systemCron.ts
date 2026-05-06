import { existsSync } from 'node:fs'
import { readFile, stat, writeFile, chmod, chown } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const BEGIN = '# BEGIN HANASAND MANAGED CRON'
const END = '# END HANASAND MANAGED CRON'

export type ManagedCronDefinition = {
    id: string
    name: string
    description: string
    defaultSchedule: string
    command: string
    legacyCommands?: string[]
    host: string
    logPath?: string
}

export type ManagedCronJob = ManagedCronDefinition & {
    schedule: string
    enabled: boolean
    installed: boolean
    lastLogLine: string | null
    lastLogAt: string | null
}

export type ManagedCronUpdate = {
    schedule?: unknown
    enabled?: unknown
}

const CRON_USER = process.env.MANAGED_CRON_USER || process.env.HOST_USER || 'hanasand'
const CRON_SPOOL_DIR = process.env.MANAGED_CRON_SPOOL_DIR || '/host/cron/crontabs'
const HOST_HOME_PREFIX = process.env.MANAGED_CRON_HOST_HOME_PREFIX || '/host/home'
const CRON_WRITE_USER = process.env.MANAGED_CRON_WRITE_USER || 'bun'

export const managedCronDefinitions: ManagedCronDefinition[] = [
    {
        id: 'forgejo-standby-sync',
        name: 'Forgejo standby sync',
        description: 'Repairs Forgejo metadata, copies the active Git service to OVH standby, restores the database, and health-checks the standby.',
        defaultSchedule: '*/5 * * * *',
        command: 'LOG=/home/hanasand/git/standby-sync.log /home/hanasand/git/sync-to-ovh.sh',
        legacyCommands: [
            '/home/hanasand/git/sync-to-ovh.sh',
            'cd /home/hanasand/git && LOCK=/tmp/forgejo-standby-sync.lock LOG=/home/hanasand/git/standby-sync.log bash scripts/sync-to-ovh.sh',
        ],
        host: 'inspur',
        logPath: '/home/hanasand/git/standby-sync.log',
    },
    {
        id: 'forgejo-doctor',
        name: 'Forgejo doctor',
        description: 'Runs Forgejo repository metadata checks and fixes repository HEAD, hook, key, and push-option drift.',
        defaultSchedule: '17 * * * *',
        command: 'cd /home/hanasand/git && LOG_FILE=/home/hanasand/git/forgejo-doctor.log FIX=1 bash scripts/forgejo-doctor.sh',
        host: 'inspur',
        logPath: '/home/hanasand/git/forgejo-doctor.log',
    },
]

export async function listManagedCronJobs(): Promise<ManagedCronJob[]> {
    const crontab = await readCrontab()
    const entries = parseManagedBlock(crontab)
    const existingEntries = parseExistingCronEntries(crontab)

    return Promise.all(managedCronDefinitions.map(async(definition) => {
        const entry = entries.get(definition.id) || existingEntries.get(definition.id)
        const log = await readLastLogLine(definition.logPath)

        return {
            ...definition,
            schedule: entry?.schedule || definition.defaultSchedule,
            enabled: entry ? entry.enabled : false,
            installed: Boolean(entry),
            lastLogLine: log.line,
            lastLogAt: log.createdAt,
        }
    }))
}

export async function updateManagedCronJob(id: string, input: ManagedCronUpdate) {
    const definition = managedCronDefinitions.find(job => job.id === id)
    if (!definition) {
        throw new Error('Managed cron job not found.')
    }

    const schedule = input.schedule === undefined
        ? undefined
        : normalizeSchedule(input.schedule)
    const enabled = input.enabled === undefined
        ? undefined
        : Boolean(input.enabled)
    const crontab = await readCrontab()
    const entries = parseManagedBlock(crontab)
    const existingEntries = parseExistingCronEntries(crontab)
    for (const [entryId, entry] of existingEntries) {
        if (!entries.has(entryId)) entries.set(entryId, entry)
    }
    const current = entries.get(id)
    entries.set(id, {
        schedule: schedule || current?.schedule || definition.defaultSchedule,
        enabled: enabled ?? current?.enabled ?? true,
    })

    await writeCrontab(replaceManagedBlock(crontab, entries))
    return (await listManagedCronJobs()).find(job => job.id === id)!
}

function normalizeSchedule(value: unknown) {
    const schedule = String(value || '').trim().replace(/\s+/g, ' ')
    const fields = schedule.split(' ')
    if (fields.length !== 5) {
        throw new Error('Cron schedule must contain exactly five fields.')
    }
    if (!fields.every(field => /^[\d*/,-]+$/.test(field))) {
        throw new Error('Cron schedule contains unsupported characters.')
    }
    return schedule
}

async function readCrontab() {
    const spoolPath = hostCrontabPath()
    if (spoolPath && existsSync(spoolPath)) {
        return readFile(spoolPath, 'utf8')
    }

    try {
        const { stdout } = await execFileAsync('crontab', ['-l'])
        return stdout
    } catch {
        return ''
    }
}

async function writeCrontab(content: string) {
    const normalized = content.trimEnd() + '\n'
    const spoolPath = hostCrontabPath()

    if (spoolPath && existsSync(CRON_SPOOL_DIR)) {
        let uid = Number(process.env.MANAGED_CRON_UID || 1000)
        let gid = Number(process.env.MANAGED_CRON_GID || 1000)
        if (existsSync(spoolPath)) {
            const current = await stat(spoolPath)
            uid = current.uid
            gid = current.gid
        }
        try {
            await writeFile(spoolPath, normalized, 'utf8')
        } catch (error) {
            if (!isAccessError(error)) throw error
            await writeFileAsOwner(spoolPath, normalized)
        }
        await chmod(spoolPath, 0o600).catch(() => undefined)
        await chown(spoolPath, uid, gid).catch(() => undefined)
        return
    }

    await writeCrontabCommand(normalized)
}

function hostCrontabPath() {
    return CRON_SPOOL_DIR ? `${CRON_SPOOL_DIR}/${CRON_USER}` : ''
}

function parseManagedBlock(crontab: string) {
    const entries = new Map<string, { schedule: string, enabled: boolean }>()
    const block = extractManagedBlock(crontab)
    if (!block) return entries

    let pendingId = ''
    for (const rawLine of block.split('\n')) {
        const line = rawLine.trim()
        const idMatch = line.match(/^#\s*id=([A-Za-z0-9_-]+)/)
        if (idMatch) {
            pendingId = idMatch[1]
            continue
        }
        if (!pendingId || !line) continue
        const enabled = !line.startsWith('#')
        const activeLine = enabled ? line : line.replace(/^#\s*/, '')
        const parts = activeLine.split(/\s+/)
        if (parts.length < 6) continue
        entries.set(pendingId, {
            schedule: parts.slice(0, 5).join(' '),
            enabled,
        })
        pendingId = ''
    }
    return entries
}

function parseExistingCronEntries(crontab: string) {
    const entries = new Map<string, { schedule: string, enabled: boolean }>()
    const managedFreeCrontab = removeManagedBlock(crontab)

    for (const rawLine of managedFreeCrontab.split('\n')) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const parts = line.split(/\s+/)
        if (parts.length < 6) continue

        const schedule = parts.slice(0, 5).join(' ')
        const command = parts.slice(5).join(' ')
        const definition = managedCronDefinitions.find(job => job.command === command || job.legacyCommands?.includes(command))
        if (!definition) continue

        entries.set(definition.id, {
            schedule,
            enabled: true,
        })
    }

    return entries
}

function extractManagedBlock(crontab: string) {
    const start = crontab.indexOf(BEGIN)
    const end = crontab.indexOf(END)
    if (start === -1 || end === -1 || end <= start) return ''
    return crontab.slice(start + BEGIN.length, end)
}

function replaceManagedBlock(crontab: string, entries: Map<string, { schedule: string, enabled: boolean }>) {
    const unmanaged = removeManagedCronLines(removeManagedBlock(crontab)).trimEnd()
    const block = renderManagedBlock(entries)
    return [unmanaged, block].filter(Boolean).join('\n\n')
}

function removeManagedCronLines(crontab: string) {
    const commands = new Set(managedCronDefinitions.flatMap(job => [job.command, ...(job.legacyCommands || [])]))
    return crontab
        .split('\n')
        .filter(rawLine => {
            const line = rawLine.trim()
            if (!line || line.startsWith('#')) return true
            const parts = line.split(/\s+/)
            if (parts.length < 6) return true
            return !commands.has(parts.slice(5).join(' '))
        })
        .join('\n')
}

function removeManagedBlock(crontab: string) {
    const start = crontab.indexOf(BEGIN)
    const end = crontab.indexOf(END)
    if (start === -1 || end === -1 || end <= start) return crontab
    return `${crontab.slice(0, start)}${crontab.slice(end + END.length)}`.trim()
}

function renderManagedBlock(entries: Map<string, { schedule: string, enabled: boolean }>) {
    const lines = [BEGIN, '# Managed by Hanasand. Edit from the dashboard or source-controlled defaults.']
    for (const definition of managedCronDefinitions) {
        const entry = entries.get(definition.id) || {
            schedule: definition.defaultSchedule,
            enabled: false,
        }
        lines.push(`# id=${definition.id} name=${definition.name}`)
        lines.push(`${entry.enabled ? '' : '# '}${entry.schedule} ${definition.command}`)
    }
    lines.push(END)
    return lines.join('\n')
}

async function readLastLogLine(logPath?: string) {
    if (!logPath) return { line: null, createdAt: null }
    const hostPath = toHostPath(logPath)
    if (!existsSync(hostPath)) return { line: null, createdAt: null }
    try {
        const [contents, details] = await Promise.all([
            readFile(hostPath, 'utf8'),
            stat(hostPath),
        ])
        const lines = contents.trim().split('\n').filter(Boolean)
        return {
            line: lines.at(-1) || null,
            createdAt: details.mtime.toISOString(),
        }
    } catch {
        return { line: null, createdAt: null }
    }
}

function toHostPath(path: string) {
    if (path.startsWith('/home/')) {
        return `${HOST_HOME_PREFIX}${path.slice('/home'.length)}`
    }
    return path
}

function writeCrontabCommand(content: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('crontab', ['-'], {
            stdio: ['pipe', 'ignore', 'pipe'],
        })
        const stderr: Buffer[] = []

        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `crontab exited with status ${code}`))
        })
        child.stdin.end(content)
    })
}

function writeFileAsOwner(path: string, content: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('su', [CRON_WRITE_USER, '-s', '/bin/sh', '-c', `umask 077; cat > ${shellQuote(path)}`], {
            stdio: ['pipe', 'ignore', 'pipe'],
        })
        const stderr: Buffer[] = []

        child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `owner write exited with status ${code}`))
        })
        child.stdin.end(content)
    })
}

function shellQuote(value: string) {
    return `'${value.replaceAll('\'', '\'\\\'\'')}'`
}

function isAccessError(error: unknown) {
    return error && typeof error === 'object' && 'code' in error && error.code === 'EACCES'
}
