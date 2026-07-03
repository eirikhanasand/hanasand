import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { scheduledJobRegistryGuardrailEntries } from '../src/utils/systemCron.ts'

const repoRoot = path.resolve(import.meta.dir, '..', '..')
const scanRoots = ['api/src', 'ti/scraper/src', 'docker-compose.yml']
const schedulerPattern = /\b(schedule\s*\(|setInterval\s*\(|startCanaryCollectionLoop\b|runDue[A-Za-z0-9_]*\b|cron\b|crontab\b)/i
const ignoredPattern = /(^|\/)(tests?|fixtures?|docs?|node_modules)(\/|$)/
const registeredSources = new Set(scheduledJobRegistryGuardrailEntries().map(entry => normalize(entry.source)))

const candidates: string[] = []
for (const root of scanRoots) {
    await collect(path.join(repoRoot, root), candidates)
}

const unregistered = candidates
    .map(file => normalize(path.relative(repoRoot, file)))
    .filter(file => !registeredSources.has(file))
    .filter(file => !isAllowedIncidentalSchedulerFile(file))
    .sort()

if (unregistered.length) {
    const message = [
        'Unregistered scheduled/background code candidates:',
        ...unregistered.map(file => `- ${file}`),
        'Add intentional recurring work to scheduledJobRegistryGuardrailEntries()/listUnifiedScheduledJobs, or add a narrow scanner exception.',
    ].join('\n')
    if (process.env.FAIL_ON_UNREGISTERED_SCHEDULED_CODE === '1') {
        throw new Error(message)
    }
    console.warn(message)
} else {
    console.log('Scheduled job registry guardrail passed.')
}

async function collect(target: string, output: string[]) {
    if (ignoredPattern.test(normalize(path.relative(repoRoot, target)))) return
    if (target.endsWith('docker-compose.yml')) {
        await addIfCandidate(target, output)
        return
    }

    const entries = await readdir(target, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
        const next = path.join(target, entry.name)
        if (entry.isDirectory()) {
            await collect(next, output)
        } else if (/\.(ts|tsx|js|mjs|yml|yaml)$/.test(entry.name)) {
            await addIfCandidate(next, output)
        }
    }
}

async function addIfCandidate(file: string, output: string[]) {
    const contents = await readFile(file, 'utf8').catch(() => '')
    if (schedulerPattern.test(contents)) output.push(file)
}

function normalize(value: string) {
    return value.split(path.sep).join('/')
}

function isAllowedIncidentalSchedulerFile(file: string) {
    return [
        'api/src/index.ts',
        'api/src/routes.ts',
        'api/src/handlers/onionSession/ws.ts',
        'api/src/handlers/systemCron.ts',
        'api/src/handlers/traffic/legacy.ts',
        'api/src/handlers/ti/pipeline.ts',
        'api/src/utils/auth/tokenWrapper.ts',
        'ti/scraper/src/api/server.ts',
        'ti/scraper/src/runtime/startup.ts',
        'ti/scraper/src/ops/canaryActivation.ts',
        'ti/scraper/src/api/canaryRoutes.ts',
        'ti/scraper/src/registry/sourceReconciliation.ts',
        'ti/scraper/src/frontier/schedulerProductionApply.ts',
        'ti/scraper/src/frontier/schedulerProductionRuntime.ts',
        'ti/scraper/src/frontier/schedulerProduction.ts',
        'ti/scraper/src/frontier/schedulerProductionCore.ts',
        'ti/scraper/src/frontier/schedulerProductionFreshness.ts',
        'ti/scraper/src/frontier/schedulerProductionRepositories.ts',
    ].includes(file)
}
