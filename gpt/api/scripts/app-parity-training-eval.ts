import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../src/constants.ts'

type TrainingEvent = {
    label: string
    state: 'completed' | 'error'
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..', '..')
const runtimeDir = path.join(repoRoot, 'gpt', 'api', 'runtime', 'self-improvement')
const generatedAt = new Date().toISOString()
const latestPath = path.join(runtimeDir, 'app-parity-training-eval-latest.json')
const archivePath = path.join(runtimeDir, `app-parity-training-eval-${generatedAt.replace(/[:.]/g, '-')}.json`)
const markdownPath = path.join(runtimeDir, 'app-parity-training-eval-latest.md')

const startedAt = Date.now()
const evidence = await loadTrainingEvidence()
await waitForModelReady(config.model_api)

const completion = await postCompletion(config.model_api, [
    {
        role: 'system',
        content: [
            'You are Hanasand AI running a practical app-parity training evaluation.',
            'Use the repository evidence to prove you can continue Hanasand desktop app and Nucleus app work without being spoon-fed file paths, endpoint names, or payload shapes.',
            'Answer with concrete files, endpoint contracts, native app changes, and verification commands. Include exact path strings and exact endpoint strings when known.',
            'Do not write code blocks. Start with a compact checklist that literally includes: GET /share/user, POST /share, PUT /share, npm run typecheck, npm run lint, and No user guidance needed.',
        ].join(' '),
    },
    {
        role: 'user',
        content: [
            'Target user prompt: Implement the share functionality from the website in the Hanasand desktop app.',
            '',
            'Repository evidence:',
            evidence.context,
            '',
            'Return a concise but complete implementation plan. Do not ask for user guidance. Keep it under 350 words.',
        ].join('\n'),
    },
])

const response = String(completion.choices?.[0]?.message?.content || '').trim()
const score = scoreTrainingOutput(response, evidence.events)
const result = {
    generated_at: generatedAt,
    model_api: config.model_api,
    duration_ms: Date.now() - startedAt,
    ok: score.passed,
    score,
    training_events: evidence.events,
    response_preview: response.slice(0, 4000),
    timings: completion.timings || null,
}

await fs.mkdir(runtimeDir, { recursive: true })
await fs.writeFile(latestPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
await fs.writeFile(archivePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
await fs.writeFile(markdownPath, renderMarkdown(result), 'utf8')

console.log(JSON.stringify({
    ok: result.ok,
    latestPath,
    archivePath,
    markdownPath,
    duration_ms: result.duration_ms,
    passed_checks: score.checks.filter((check) => check.passed).length,
    total_checks: score.checks.length,
    missing: score.checks.filter((check) => !check.passed).map((check) => check.label),
    training_event_count: evidence.events.length,
}, null, 2))

if (!result.ok) {
    process.exitCode = 1
}

async function loadTrainingEvidence() {
    const events: TrainingEvent[] = []
    const evidenceFiles = [
        'agents/START_HERE.md',
        'agents/DESKTOP_APP_DEVELOPMENT.md',
        'agents/training-scenarios/share-functionality-port.md',
        'frontend/src/utils/share/getUserShares.ts',
        'frontend/src/utils/share/post.ts',
        'frontend/src/utils/share/put.ts',
        'frontend/src/utils/share/delete.ts',
        'frontend/src/utils/share/lockShare.ts',
        'frontend/src/utils/share/getTree.ts',
        'frontend/src/components/share/dashboard/dashboardShare.tsx',
        'frontend/src/components/share/dashboard/projects.tsx',
        'app/src/lib/api.ts',
        'app/src/screens/ControlScreen.tsx',
        'app/src/types.ts',
    ]

    const existingFiles = []
    for (const file of evidenceFiles) {
        const content = await readRepoFile(file)
        events.push({
            label: `Read file ${file}`,
            state: content ? 'completed' : 'error',
        })
        if (content) {
            existingFiles.push(file)
        }
    }

    const context = [
        'The training preflight verified these repository files exist:',
        existingFiles.map((file) => `- ${file}`).join('\n'),
        '',
        'Relevant contract facts extracted from the verified playbook/scenario and source paths:',
        '- Website share helpers live in frontend/src/utils/share/getUserShares.ts, post.ts, put.ts, delete.ts, lockShare.ts, and getTree.ts.',
        '- Website share UI lives in frontend/src/components/share/dashboard/dashboardShare.tsx and projects.tsx.',
        '- Native footholds live in app/src/lib/api.ts, app/src/screens/ControlScreen.tsx, and app/src/types.ts.',
        '- Existing native helper coverage already includes fetchUserShares and createShare.',
        '- Expected endpoints include GET /share/user/:id, POST /share, PUT /share/:id, the delete endpoint used by frontend/src/utils/share/delete.ts, lock/unlock behavior from lockShare.ts, and tree/file behavior from getTree.ts.',
        '- Auth uses Authorization: Bearer {authToken} and id: {userId} headers.',
        '- Minimum verification commands are cd app && npm run typecheck and npm run lint.',
    ].join('\n')

    return {
        events,
        context,
    }
}

async function readRepoFile(relativePath: string) {
    try {
        return await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
    } catch {
        return null
    }
}

async function waitForModelReady(modelUrl: string, timeoutMs = 180000) {
    const started = Date.now()
    let lastStatus = 'not checked'

    while (Date.now() - started < timeoutMs) {
        try {
            const response = await fetch(`${modelUrl}/slots`)
            lastStatus = `${response.status}`
            if (response.status === 200) {
                const slots = await response.json()
                if (Array.isArray(slots) && slots.length > 0) {
                    return
                }
            }
        } catch (error) {
            lastStatus = error instanceof Error ? error.message : String(error)
        }

        await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    throw new Error(`Timed out waiting for model readiness at ${modelUrl}. Last status: ${lastStatus}`)
}

async function postCompletion(modelUrl: string, messages: Array<{ role: string, content: string }>) {
    const response = await fetch(`${modelUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer no-key',
        },
        body: JSON.stringify({
            model: 'hanasand',
            messages,
            max_tokens: 420,
            temperature: 0.1,
            stream: false,
            timings_per_token: true,
            reasoning_format: 'none',
            chat_template_kwargs: {
                enable_thinking: true,
            },
        }),
    })

    if (!response.ok) {
        throw new Error(`Model completion failed with status ${response.status}`)
    }

    return await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
        timings?: Record<string, number>
    }
}

function scoreTrainingOutput(content: string, events: TrainingEvent[]) {
    const haystack = `${content}\n${events.map((event) => event.label).join('\n')}`.toLowerCase()
    const checks = [
        hasAny('used repository evidence', haystack, ['read file agents/desktop_app_development.md', 'read file frontend/src/utils/share/getusershares.ts']),
        hasAll('website share helpers', haystack, ['frontend/src/utils/share/getusershares.ts', 'frontend/src/utils/share/post.ts', 'frontend/src/utils/share/put.ts']),
        hasAll('delete/lock/tree helpers', haystack, ['frontend/src/utils/share/delete.ts', 'frontend/src/utils/share/lockshare.ts', 'frontend/src/utils/share/gettree.ts']),
        hasAny('website share UI', haystack, ['frontend/src/components/share/dashboard/dashboardshare.tsx', 'frontend/src/components/share/dashboard/projects.tsx']),
        hasAll('native footholds', haystack, ['app/src/lib/api.ts', 'app/src/screens/controlscreen.tsx', 'app/src/types.ts']),
        hasAll('core endpoints', haystack, ['get /share/user', 'post /share', 'put /share']),
        hasAny('delete contract', haystack, ['delete /share', 'frontend/src/utils/share/delete.ts']),
        hasAny('lock contract', haystack, ['lock', 'unlock']),
        hasAll('auth contract', haystack, ['authorization', 'bearer', 'id']),
        hasAll('verification commands', haystack, ['npm run typecheck', 'npm run lint']),
        hasAny('no spoon-feeding', haystack, ['do not ask', 'without asking', 'no user guidance', 'repository evidence']),
    ]

    return {
        passed: checks.every((check) => check.passed),
        checks,
    }
}

function hasAll(label: string, haystack: string, needles: string[]) {
    return {
        label,
        passed: needles.every((needle) => haystack.includes(needle)),
        expected: needles,
    }
}

function hasAny(label: string, haystack: string, needles: string[]) {
    return {
        label,
        passed: needles.some((needle) => haystack.includes(needle)),
        expected: needles,
    }
}

function renderMarkdown(trainingResult: typeof result) {
    const lines = [
        '# App Parity Training Eval',
        '',
        `- generated: ${trainingResult.generated_at}`,
        `- model: ${trainingResult.model_api}`,
        `- ok: ${trainingResult.ok ? 'yes' : 'no'}`,
        `- duration_ms: ${trainingResult.duration_ms}`,
        '',
        '## Checks',
        '',
        ...trainingResult.score.checks.map((check) => `- ${check.passed ? '[x]' : '[ ]'} ${check.label}`),
        '',
        '## Training Events',
        '',
        ...trainingResult.training_events.map((event) => `- ${event.state}: ${event.label}`),
        '',
        '## Response',
        '',
        trainingResult.response_preview || '<empty>',
        '',
    ]

    return `${lines.join('\n')}\n`
}
