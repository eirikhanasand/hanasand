import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileAsync = promisify(execFile)
const generatedAt = new Date().toISOString()
const modelUrl = process.env.HANASAND_BENCHMARK_MODEL_URL || 'http://127.0.0.1:18081'
const expectedProfile = process.env.HANASAND_EXPECTED_PROFILE || 'validation'
const expectedModelSubstring = process.env.HANASAND_EXPECTED_MODEL_SUBSTRING || 'qwen2.5-coder-14b'
const runtimeDir = path.resolve('runtime', 'self-improvement')
const latestPath = path.join(runtimeDir, 'mac-validation-profile-smoke-latest.json')
const archivePath = path.join(runtimeDir, `mac-validation-profile-smoke-${generatedAt.replace(/[:.]/g, '-')}.json`)
const selectionArtifactPath = path.resolve('..', 'runtime', 'self-improvement', 'model-selection-latest.json')

const props = await requestJson(modelUrl, '/props')
const slots = await requestJson(modelUrl, '/slots')
const selectionArtifact = await readJson(selectionArtifactPath)

const modelPath = String(props.json?.model_path || '')
const contextSize = Array.isArray(slots.json) ? Number(slots.json[0]?.n_ctx || 0) : 0
const artifact = {
    generated_at: generatedAt,
    model_api: modelUrl,
    expected_profile: expectedProfile,
    expected_model_substring: expectedModelSubstring,
    actual_model_path: modelPath,
    actual_context_size: contextSize,
    selection_artifact: selectionArtifact,
    ok: props.ok && slots.ok
        && modelPath.includes(expectedModelSubstring)
        && (!selectionArtifact || selectionArtifact.profile === expectedProfile),
}

await fs.mkdir(runtimeDir, { recursive: true })
await fs.writeFile(latestPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
await fs.writeFile(archivePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
    ok: artifact.ok,
    latestPath,
    archivePath,
    expectedProfile,
    actualModelPath: modelPath,
    actualContextSize: contextSize,
}, null, 2))

async function requestJson(modelUrl, endpoint) {
    const { stdout, stderr } = await execFileAsync('curl', [
        '-sS',
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
