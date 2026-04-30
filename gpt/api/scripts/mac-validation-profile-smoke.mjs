import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)
const generatedAt = new Date().toISOString()
const modelUrl = process.env.HANASAND_BENCHMARK_MODEL_URL || 'http://127.0.0.1:18081'
const expectedProfile = process.env.HANASAND_EXPECTED_PROFILE || 'validation'
const expectedModelSubstring = process.env.HANASAND_EXPECTED_MODEL_SUBSTRING || 'qwen2.5-coder-14b'
const runtimeDir = path.resolve('runtime', 'self-improvement')
const latestPath = path.join(runtimeDir, 'mac-validation-profile-smoke-latest.json')
const latestMarkdownPath = path.join(runtimeDir, 'mac-validation-profile-smoke-latest.md')
const archivePath = path.join(runtimeDir, `mac-validation-profile-smoke-${generatedAt.replace(/[:.]/g, '-')}.json`)
const archiveMarkdownPath = path.join(runtimeDir, `mac-validation-profile-smoke-${generatedAt.replace(/[:.]/g, '-')}.md`)
const selectionArtifactPath = path.resolve('..', 'runtime', 'self-improvement', 'model-selection-latest.json')
const startedAt = Date.now()

await fs.mkdir(runtimeDir, { recursive: true })

try {
    const memoryBefore = memorySnapshot()
    const props = await requestJson(modelUrl, '/props')
    const slots = await requestJson(modelUrl, '/slots')
    const memoryAfter = memorySnapshot()
    const selectionArtifact = await readJson(selectionArtifactPath)

    const modelPath = String(props.json?.model_path || '')
    const contextSize = Array.isArray(slots.json) ? Number(slots.json[0]?.n_ctx || 0) : 0
    const profileTag = selectionArtifact?.profile || expectedProfile
    const artifact = {
        generated_at: generatedAt,
        model_api: modelUrl,
        profile_tag: profileTag,
        baseline_key: `model_warmup:${profileTag}`,
        expected_profile: expectedProfile,
        expected_model_substring: expectedModelSubstring,
        actual_model_path: modelPath,
        actual_context_size: contextSize,
        selection_artifact: selectionArtifact,
        warmup: {
            status: 'ready',
            total_ms: Date.now() - startedAt,
            probes: {
                props_ms: props.ms,
                slots_ms: slots.ms,
            },
            memory_before: memoryBefore,
            memory_after: memoryAfter,
            memory_delta: memoryDelta(memoryBefore, memoryAfter),
        },
        ok: props.ok && slots.ok
            && modelPath.includes(expectedModelSubstring)
            && (!selectionArtifact || selectionArtifact.profile === expectedProfile),
    }

    await writeArtifacts(artifact)

    console.log(JSON.stringify({
        ok: artifact.ok,
        latestPath,
        latestMarkdownPath,
        archivePath,
        archiveMarkdownPath,
        expectedProfile,
        actualModelPath: modelPath,
        actualContextSize: contextSize,
        warmupTotalMs: artifact.warmup.total_ms,
        baselineKey: artifact.baseline_key,
    }, null, 2))
} catch (error) {
    const artifact = {
        generated_at: generatedAt,
        model_api: modelUrl,
        profile_tag: expectedProfile,
        baseline_key: `model_warmup:${expectedProfile}`,
        expected_profile: expectedProfile,
        expected_model_substring: expectedModelSubstring,
        actual_model_path: '',
        actual_context_size: 0,
        selection_artifact: await readJson(selectionArtifactPath),
        warmup: {
            status: 'failed',
            total_ms: Date.now() - startedAt,
            failure: serializeError(error),
            memory_before: null,
            memory_after: memorySnapshot(),
            memory_delta: null,
        },
        ok: false,
    }
    await writeArtifacts(artifact)
    console.log(JSON.stringify({
        ok: false,
        latestPath,
        latestMarkdownPath,
        archivePath,
        archiveMarkdownPath,
        expectedProfile,
        warmupTotalMs: artifact.warmup.total_ms,
        baselineKey: artifact.baseline_key,
        error: artifact.warmup.failure.message,
    }, null, 2))
    process.exitCode = 1
}

async function requestJson(modelUrl, endpoint) {
    const startedAt = Date.now()
    const { stdout, stderr } = await execFileAsync('curl', [
        '-sS',
        '--max-time',
        process.env.HANASAND_WARMUP_CURL_TIMEOUT || '8',
        '-w',
        '\n%{http_code}',
        `${modelUrl}${endpoint}`,
    ])
    const output = `${stdout}${stderr || ''}`.trimEnd()
    const newline = output.lastIndexOf('\n')
    const text = newline >= 0 ? output.slice(0, newline) : output
    const status = Number(newline >= 0 ? output.slice(newline + 1) : 0)
    return {
        ok: status >= 200 && status < 300,
        status,
        ms: Date.now() - startedAt,
        json: text ? JSON.parse(text) : null,
    }
}

async function readJson(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'))
    } catch {
        return null
    }
}

async function writeArtifacts(artifact) {
    await fs.writeFile(latestPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    await fs.writeFile(archivePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    const markdown = renderMarkdown(artifact)
    await fs.writeFile(latestMarkdownPath, `${markdown}\n`, 'utf8')
    await fs.writeFile(archiveMarkdownPath, `${markdown}\n`, 'utf8')
}

function memorySnapshot() {
    const totalBytes = os.totalmem()
    const freeBytes = os.freemem()
    const processMemory = process.memoryUsage()
    return {
        total_gb: roundGb(totalBytes),
        free_gb: roundGb(freeBytes),
        used_gb: roundGb(totalBytes - freeBytes),
        pressure: Number(((totalBytes - freeBytes) / totalBytes).toFixed(4)),
        process_rss_mb: Math.round(processMemory.rss / 1024 / 1024),
        process_heap_used_mb: Math.round(processMemory.heapUsed / 1024 / 1024),
    }
}

function memoryDelta(before, after) {
    return {
        free_gb: Number((after.free_gb - before.free_gb).toFixed(3)),
        used_gb: Number((after.used_gb - before.used_gb).toFixed(3)),
        pressure: Number((after.pressure - before.pressure).toFixed(4)),
        process_rss_mb: after.process_rss_mb - before.process_rss_mb,
    }
}

function roundGb(bytes) {
    return Number((bytes / 1024 / 1024 / 1024).toFixed(3))
}

function serializeError(error) {
    return {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        code: error?.code || null,
        signal: error?.signal || null,
        status: error?.status || null,
    }
}

function renderMarkdown(artifact) {
    const warmup = artifact.warmup || {}
    return `# Mac Validation Profile Warmup

Updated: ${String(artifact.generated_at).slice(0, 10)}

## Summary
- ok: ${artifact.ok ? 'yes' : 'no'}
- status: ${warmup.status || 'unknown'}
- profile: ${artifact.profile_tag}
- baseline key: ${artifact.baseline_key}
- model API: ${artifact.model_api}
- total warmup/readiness ms: ${warmup.total_ms ?? 'n/a'}
- actual model: ${artifact.actual_model_path || 'unknown'}
- context size: ${artifact.actual_context_size || 0}

## Probes
- props ms: ${warmup.probes?.props_ms ?? 'n/a'}
- slots ms: ${warmup.probes?.slots_ms ?? 'n/a'}

## Memory
- before used/free GB: ${warmup.memory_before ? `${warmup.memory_before.used_gb}/${warmup.memory_before.free_gb}` : 'n/a'}
- after used/free GB: ${warmup.memory_after ? `${warmup.memory_after.used_gb}/${warmup.memory_after.free_gb}` : 'n/a'}
- delta used GB: ${warmup.memory_delta?.used_gb ?? 'n/a'}
- pressure delta: ${warmup.memory_delta?.pressure ?? 'n/a'}

## Failure
${warmup.failure ? `- ${warmup.failure.name}: ${warmup.failure.message}` : '- none'}`
}
