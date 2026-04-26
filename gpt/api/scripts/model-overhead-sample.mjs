import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeModelOverheadSample } from '../distless/model-overhead-bridge.mjs'

const execFileAsync = promisify(execFile)
const conversationId = `overhead-sample-${Date.now()}`
const modelUrl = process.env.HANASAND_BENCHMARK_MODEL_URL || 'http://127.0.0.1:18081'
const profileTag = process.env.HANASAND_MODEL_PROFILE || process.env.MODEL_NAME_OVERRIDE || 'benchmark-unspecified'
const messages = [
    {
        role: 'user',
        content: 'Summarize in one short sentence why measuring runtime overhead matters for an autonomous coding agent.',
    },
]

await waitForModelReady(modelUrl)

const totalStartedAt = Date.now()
const renderedPrompt = await postJson(modelUrl, '/apply-template', { messages })
const promptText = typeof renderedPrompt.json.prompt === 'string'
    ? renderedPrompt.json.prompt
    : messages.map((message) => message.content).join('\n')

const tokenizedPrompt = await postJson(modelUrl, '/tokenize', { content: promptText })
const slotsBefore = await getJson(modelUrl, '/slots')
const completion = await postJson(modelUrl, '/v1/chat/completions', {
    model: 'hanasand',
    messages,
    max_tokens: 120,
    temperature: 0.2,
    stream: false,
    timings_per_token: true,
    reasoning_format: 'none',
    chat_template_kwargs: {
        enable_thinking: true,
    },
})

const content = String(
    Array.isArray(completion.json.choices)
        ? completion.json.choices?.[0]?.message?.content || ''
        : ''
).trim()
const tokenizedOutput = await postJson(modelUrl, '/tokenize', { content })
const slotsAfter = await getJson(modelUrl, '/slots')

const promptTokens = Array.isArray(tokenizedPrompt.json) ? tokenizedPrompt.json.length : 0
const generatedTokens = Array.isArray(tokenizedOutput.json) ? tokenizedOutput.json.length : 0
const timings = typeof completion.json.timings === 'object' && completion.json.timings
    ? completion.json.timings
    : {}

const contextMaxTokens = Array.isArray(slotsAfter.json)
    ? Number(slotsAfter.json[0]?.n_ctx || 0)
    : Array.isArray(slotsBefore.json)
        ? Number(slotsBefore.json[0]?.n_ctx || 0)
        : 0

const persisted = await writeModelOverheadSample({
    sampleId: `${conversationId}:node-loopback`,
    sampleSource: 'node_loopback_sample',
    profileTag,
    recordedAt: new Date().toISOString(),
    conversationId,
    clientName: 'packet-75-node-sample',
    modelApi: modelUrl,
    promptMessages: messages.length,
    maxTokens: 120,
    promptTokens,
    generatedTokens,
    contextMaxTokens,
    tps: Number(timings.predicted_per_second || 0),
    stages: {
        renderPromptMs: renderedPrompt.ms,
        tokenizePromptMs: tokenizedPrompt.ms,
        fetchContextMs: slotsBefore.ms,
        toolLoopMs: completion.ms,
        tokenizeOutputMs: tokenizedOutput.ms,
        syncOutputContextMs: slotsAfter.ms,
        streamEmitMs: 0,
        totalMs: Date.now() - totalStartedAt,
    },
    loop: {
        iterations: 1,
        completionCalls: 1,
        completionMs: completion.ms,
        toolCalls: 0,
        toolMs: 0,
        totalMs: completion.ms,
    },
    llama: {
        cache_n: Number(timings.cache_n || 0),
        prompt_n: Number(timings.prompt_n || 0),
        predicted_n: Number(timings.predicted_n || 0),
        predicted_per_second: Number(timings.predicted_per_second || 0),
    },
})

const latest = JSON.parse(await readFile(persisted.latestJsonPath, 'utf8'))
console.log(JSON.stringify({
    ok: true,
    conversationId,
    latestPath: persisted.latestJsonPath,
    markdownPath: persisted.latestMarkdownPath,
    totalMs: latest.stages?.totalMs || null,
    nextOptimizationTarget: latest.derived?.nextOptimizationTarget || null,
    nextOptimizationReason: latest.derived?.nextOptimizationReason || null,
}, null, 2))

async function waitForModelReady(modelUrl, timeoutMs = 180000) {
    const startedAt = Date.now()
    let lastMessage = 'Model did not respond yet.'

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await getJson(modelUrl, '/slots')
            if (response.status === 503) {
                lastMessage = 'Model is still loading.'
                await sleep(1500)
                continue
            }

            if (response.status !== 200) {
                lastMessage = `Unexpected slots status ${response.status}.`
                await sleep(1500)
                continue
            }

            const payload = response.json
            if (Array.isArray(payload) && payload.length > 0) {
                return payload
            }

            lastMessage = 'Slots endpoint returned no slots.'
        } catch (error) {
            lastMessage = error instanceof Error ? error.message : 'Unknown slots error.'
        }

        await sleep(1500)
    }

    throw new Error(`Timed out waiting for model readiness at ${modelUrl}. Last status: ${lastMessage}`)
}

async function postJson(modelUrl, endpoint, payload) {
    const startedAt = Date.now()
    const { stdout, stderr } = await execFileAsync('curl', [
        '-sS',
        '-X',
        'POST',
        '-H',
        'Content-Type: application/json',
        '-H',
        'Authorization: Bearer no-key',
        '--write-out',
        '\n%{http_code}',
        '--data',
        JSON.stringify(payload),
        `${modelUrl}${endpoint}`,
    ])
    const output = `${stdout}${stderr || ''}`.trimEnd()
    const newline = output.lastIndexOf('\n')
    const text = newline >= 0 ? output.slice(0, newline) : output
    return {
        ms: Date.now() - startedAt,
        json: text ? JSON.parse(text) : null,
    }
}

async function getJson(modelUrl, endpoint) {
    const startedAt = Date.now()
    const { stdout, stderr } = await execFileAsync('curl', [
        '-sS',
        '--write-out',
        '\n%{http_code}',
        `${modelUrl}${endpoint}`,
    ])
    const output = `${stdout}${stderr || ''}`.trimEnd()
    const newline = output.lastIndexOf('\n')
    const text = newline >= 0 ? output.slice(0, newline) : output
    return {
        ms: Date.now() - startedAt,
        json: text ? JSON.parse(text) : null,
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
