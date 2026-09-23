import { request } from 'node:http'
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const marker = new RegExp(`^hanasand-pg-ready-v1 nonce=(${uuid}) pid=([1-9][0-9]*)\\n/var/run/postgresql:5432 - accepting connections\\n(?![\\s\\S])`)
export type ReadinessFact = {
    version: 2; host: 'inspur'; containerId: string; execId: string; bootId: string;
    execPid: number; execParentPid: number; execStartTicks: string;
    parentPid: number; parentStartTicks: string; namespacePid: number; nonce: string;
    startedAt: number; finishedAt: number; previousStartedAt: number;
}
export type ObservedReadinessExec = Omit<ReadinessFact, 'version' | 'host' | 'finishedAt' | 'previousStartedAt'> & { observedAt: number; stableIdentity: boolean }
export type NativeHealth = { Start: string; End: string; ExitCode: number; Output: string }

/** Only Docker's own health history, never arbitrary exec output, may enter here. */
export function matchReadinessHealth(observations: ObservedReadinessExec[], health: NativeHealth, containerId: string, previousStartedAt: number): ReadinessFact | undefined {
    const startedAt = Date.parse(health.Start), finishedAt = Date.parse(health.End)
    const output = marker.exec(health.Output)
    if (!output || health.ExitCode !== 0 || !Number.isFinite(startedAt) || !Number.isFinite(finishedAt)
        || finishedAt < startedAt || !Number.isFinite(previousStartedAt)
        || previousStartedAt <= 0 || previousStartedAt >= startedAt) return
    const matches = observations.filter(o => o.containerId === containerId && o.namespacePid === Number(output[2]) && o.nonce === output[1]
        && o.stableIdentity && o.startedAt >= startedAt - 20 && o.startedAt <= finishedAt
        && o.observedAt >= startedAt && o.observedAt <= finishedAt)
    if (matches.length !== 1) return
    const o = matches[0]!
    if (!/^[0-9a-f]{64}$/.test(o.execId) || !/^[0-9a-f]{64}$/.test(containerId)
        || !new RegExp(`^${uuid}$`).test(o.bootId) || !/^[1-9][0-9]*$/.test(o.parentStartTicks)
        || !Number.isSafeInteger(o.parentPid) || o.parentPid < 1
        || !Number.isSafeInteger(o.execPid) || o.execPid < 1 || o.execPid === o.parentPid
        || !Number.isSafeInteger(o.execParentPid) || o.execParentPid < 1
        || !/^[1-9][0-9]*$/.test(o.execStartTicks)) return
    return { version: 2, host: 'inspur', containerId, execId: o.execId, bootId: o.bootId,
        execPid: o.execPid, execParentPid: o.execParentPid, execStartTicks: o.execStartTicks,
        parentPid: o.parentPid, parentStartTicks: o.parentStartTicks, namespacePid: o.namespacePid,
        nonce: output[1]!, startedAt, finishedAt, previousStartedAt }
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
function dockerJson(socketPath: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = request({ socketPath, path, timeout: 1000 }, res => {
            let data = ''
            res.on('data', chunk => { data += chunk; if (data.length > 2_000_000) req.destroy(new Error('Docker response too large')) })
            res.on('end', () => { try { if (res.statusCode !== 200) throw new Error('Docker inspection failed'); resolve(JSON.parse(data)) } catch (error) { reject(error) } })
        })
        req.on('timeout', () => req.destroy(new Error('Docker timeout')))
        req.on('error', reject); req.end()
    })
}
async function processIdentity(pid: number, containerId: string) {
    const base = `/proc/${pid}`
    const [status, rawStat, cgroup, cmdline] = await Promise.all(['status', 'stat', 'cgroup', 'cmdline'].map(name => readFile(`${base}/${name}`, 'utf8')))
    const fields = rawStat!.slice(rawStat!.lastIndexOf(')') + 2).split(' ')
    const namespacePid = Number(status!.match(/^NSpid:\s+([\d\s]+)$/m)?.[1]?.trim().split(/\s+/).at(-1))
    if (!cgroup!.includes(containerId) || !Number.isSafeInteger(namespacePid) || namespacePid < 1) throw new Error('Unbound process')
    return { pid, parentPid: Number(fields[1]), startTicks: fields[19]!, namespacePid, command: cmdline!.split('\0').filter(Boolean) }
}
export const readinessWrapperScript = 'printf "hanasand-pg-ready-v1 nonce=%s pid=%s\\n" "$1" "$$"; /usr/lib/postgresql/15/bin/pg_isready -U hanasand -d "dbname=hanasand application_name=pg_isready fallback_application_name=hanasand_probe_$1"; exit $?'
const wrapperCommand = ['/bin/sh', '-c', readinessWrapperScript, 'hanasand-readiness-v1']
const healthCommand = ['CMD-SHELL', 'pg_isready -U hanasand -d hanasand']
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function hasExpectedReadinessSource(container: any, name = 'hanasand_database'): boolean {
    return container.Name === `/${name}` && same(container.Config?.Healthcheck?.Test, healthCommand) && container.State?.Running === true
}

export async function readNativeObservation(execution: any, context: { containerId: string; execId: string; bootId: string; startedAt: number },
    readIdentity = processIdentity,
    readChildren = async (pid: number) => (await readFile(`/proc/${pid}/task/${pid}/children`, 'utf8')).trim().split(/\s+/).filter(Boolean).map(Number),
): Promise<ObservedReadinessExec | undefined> {
    if (execution.ContainerID !== context.containerId || !execution.Running || execution.ProcessConfig?.entrypoint !== '/bin/sh'
        || !same(execution.ProcessConfig?.arguments, ['-c', healthCommand[1]])) return
    const pid = execution.Pid
    if (!Number.isInteger(pid) || pid < 1) return
    const initial = await readIdentity(pid, context.containerId), candidates = []
    if (initial.pid !== pid || !same(initial.command, ['/bin/sh', '-c', healthCommand[1]])) return
    for (const child of await readChildren(pid)) {
        try { const identity = await readIdentity(child, context.containerId); if (identity.pid === child && child !== pid && identity.parentPid === pid) candidates.push(identity) } catch {}
    }
    const wrappers = candidates.filter(candidate => candidate.command.length === 5 && same(candidate.command.slice(0, 4), wrapperCommand)
        && new RegExp(`^${uuid}$`).test(candidate.command[4]!))
    if (wrappers.length !== 1) return
    const wrapper = wrappers[0]!, again = await readIdentity(wrapper.pid, context.containerId)
    if (!same(wrapper, again) || !same(initial, await readIdentity(pid, context.containerId))) return
    return { ...context, execPid: initial.pid, execParentPid: initial.parentPid, execStartTicks: initial.startTicks,
        nonce: wrapper.command[4]!, parentPid: wrapper.pid, parentStartTicks: wrapper.startTicks,
        namespacePid: wrapper.namespacePid, observedAt: Date.now(), stableIdentity: true }
}

export async function runReadinessObserver(options: { stateDir: string; socketPath?: string; containerName?: string }): Promise<never> {
    if (process.getuid?.() !== 0) throw new Error('Readiness observer requires root')
    const socket = options.socketPath ?? '/var/run/docker.sock', name = options.containerName ?? 'hanasand_database'
    await mkdir(options.stateDir, { recursive: true, mode: 0o700 })
    const directory = await stat(options.stateDir)
    if (directory.uid !== 0 || (directory.mode & 0o077)) throw new Error('Readiness directory must be root-only')
    const bootId = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim()
    let observations: ObservedReadinessExec[] = [], containerId = '', previousStartedAt = 0, lastCleanupAt = 0
    const seen = new Set<string>()
    async function observe(event: any) {
        if (event.Type !== 'container' || event.Actor?.ID !== containerId || !String(event.Action).startsWith('exec_start:')) return
        const execId = event.Actor?.Attributes?.execID
        if (!/^[0-9a-f]{64}$/.test(execId ?? '')) return
        const startedAt = Number(event.timeNano) / 1e6
        for (let retry = 0; retry < 8; retry++) {
            try {
                const execution = await dockerJson(socket, `/exec/${execId}/json`)
                const observation = await readNativeObservation(execution, { containerId, execId, bootId, startedAt })
                if (!observation) { await pause(10); continue }
                observations.push(observation)
                return
            } catch { await pause(10) }
        }
    }
    function connect() {
        const req = request({ socketPath: socket, path: '/events?filters=' + encodeURIComponent(JSON.stringify({ type: ['container'] })) }, res => {
            let pending = ''
            res.on('data', chunk => {
                pending += chunk
                if (pending.length > 1_000_000) { req.destroy(); return }
                let end: number
                while ((end = pending.indexOf('\n')) >= 0) {
                    const line = pending.slice(0, end); pending = pending.slice(end + 1)
                    try { void observe(JSON.parse(line)).catch(() => {}) } catch {}
                }
            })
            res.on('end', () => setTimeout(connect, 1000))
        })
        req.on('error', () => setTimeout(connect, 1000)); req.end()
    }
    connect()
    for (;;) {
        try {
            const container = await dockerJson(socket, `/containers/${name}/json`)
            if (!hasExpectedReadinessSource(container, name)) throw new Error('Unexpected health configuration')
            if (containerId !== container.Id) { containerId = container.Id; previousStartedAt = 0; observations = []; seen.clear() }
            for (const health of (container.State.Health?.Log ?? []) as NativeHealth[]) {
                if (seen.has(health.Start)) continue
                seen.add(health.Start)
                const fact = matchReadinessHealth(observations, health, containerId, previousStartedAt)
                // A failure or unobserved/manual record breaks the successful cadence chain.
                const healthStart = Date.parse(health.Start), healthEnd = Date.parse(health.End)
                const eligibleSuccess = marker.test(health.Output) && health.ExitCode === 0
                    && Number.isFinite(healthStart) && Number.isFinite(healthEnd) && healthEnd >= healthStart
                previousStartedAt = eligibleSuccess ? Date.parse(health.Start) : 0
                if (fact) await writeFile(`${options.stateDir}/${fact.nonce}.json`, JSON.stringify(fact) + '\n', { mode: 0o600, flag: 'wx' })
            }
            if (seen.size > 100) { const current = new Set<string>((container.State.Health?.Log ?? []).map((h: NativeHealth) => h.Start)); for (const value of seen) if (!current.has(value)) seen.delete(value) }
            observations = observations.filter(o => Date.now() - o.observedAt < 60_000).slice(-100)
            if (Date.now() - lastCleanupAt >= 60_000) {
                lastCleanupAt = Date.now()
                for (const file of await readdir(options.stateDir)) if (new RegExp(`^${uuid}\\.json$`).test(file)) {
                    const path = `${options.stateDir}/${file}`
                    if (Date.now() - (await stat(path)).mtimeMs > 3_600_000) await unlink(path)
                }
            }
        } catch { previousStartedAt = 0 }
        await pause(250)
    }
}
