import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import WebSocket from 'ws'

const execFileAsync = promisify(execFile)
const runtimeDir = path.resolve('runtime', 'self-improvement')
const now = new Date().toISOString()
const latestPath = path.join(runtimeDir, 'read-only-repo-benchmark-latest.json')
const historyPath = path.join(runtimeDir, `read-only-repo-benchmark-${now.replace(/[:.]/g, '-')}.json`)
const modelUrl = process.env.HANASAND_BENCHMARK_MODEL_URL || 'http://127.0.0.1:18081'
const wsUrl = process.env.HANASAND_BENCHMARK_WS_URL || 'ws://127.0.0.1:8080/api/client/ws/gpt'
const mode = process.env.HANASAND_BENCHMARK_MODE || 'local_direct'
const targetFile = 'frontend/src/components/ai/useAiWorkbench.ts'

const request = {
    type: 'prompt_request',
    conversationId: `benchmark-read-only-repo-${Date.now()}`,
    clientName: null,
    maxTokens: 72,
    temperature: 0.1,
    messages: [{
        role: 'user',
        content: `Inspect exactly one file in the Hanasand repo: ${targetFile}. Do not scan the whole repo. Only read the file and answer with the names of the top-level helper functions defined after the main exported hook, one per line, with no explanation. Do not edit files.`,
    }],
}

const result = mode === 'ws'
    ? await runWebSocketBenchmark({ wsUrl, request })
    : await runLocalDirectBenchmark({ modelUrl, request, targetFile })

await fs.mkdir(runtimeDir, { recursive: true })
await fs.writeFile(latestPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
await fs.writeFile(historyPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
    latestPath,
    historyPath,
    mode: result.mode,
    duration_ms: result.duration_ms,
    tool_event_count: result.tool_event_count,
    used_preloaded_read_file: result.used_preloaded_read_file,
    completed: result.completed,
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

            const slots = response.json
            if (Array.isArray(slots) && slots.length > 0) {
                return slots
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
    const status = Number(newline >= 0 ? output.slice(newline + 1) : 0)
    const json = text ? JSON.parse(text) : null
    return {
        status,
        json,
    }
}

async function getJson(modelUrl, endpoint) {
    const { stdout, stderr } = await execFileAsync('curl', [
        '-sS',
        '--write-out',
        '\n%{http_code}',
        `${modelUrl}${endpoint}`,
    ])

    const output = `${stdout}${stderr || ''}`.trimEnd()
    const newline = output.lastIndexOf('\n')
    const text = newline >= 0 ? output.slice(0, newline) : output
    const status = Number(newline >= 0 ? output.slice(newline + 1) : 0)
    return {
        status,
        json: text ? JSON.parse(text) : null,
    }
}

async function runLocalDirectBenchmark({ modelUrl, request, targetFile }) {
    const startedAt = new Date().toISOString()
    const startedMs = Date.now()
    const absoluteTargetFile = path.resolve('..', '..', targetFile)
    const source = await fs.readFile(absoluteTargetFile, 'utf8')
    const lines = source.split('\n')
    const helperStartIndex = lines.findIndex((line) => line.startsWith('function deriveLastToolState('))
    const excerptStartIndex = helperStartIndex >= 0 ? helperStartIndex : 0
    const excerptLines = lines.slice(excerptStartIndex)
    const excerpt = excerptLines.join('\n')

    await waitForModelReady(modelUrl)

    const messages = [
        {
            role: 'system',
            content: 'This is a read-only repository task. You have already been given the exact file content needed to answer. Do not broaden scope, do not invent extra file reads, and answer directly from the provided file only. Return only the requested function names, one per line, with no explanation.',
        },
        {
            role: 'user',
            content: [
                request.messages[0].content,
                '',
                `Preloaded file: ${targetFile}`,
                `Relevant excerpt lines: ${excerptStartIndex + 1}-${lines.length} of ${lines.length}`,
                '',
                excerpt,
            ].join('\n'),
        },
    ]

    const completion = await postJson(modelUrl, '/v1/chat/completions', {
        model: 'hanasand',
        messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stream: false,
        timings_per_token: true,
        reasoning_format: 'none',
        chat_template_kwargs: {
            enable_thinking: true,
        },
    })

    if (completion.status !== 200) {
        throw new Error(`Local direct benchmark failed with status ${completion.status}`)
    }

    const content = String(completion.json?.choices?.[0]?.message?.content || '').trim()
    return {
        generated_at: new Date().toISOString(),
        started_at: startedAt,
        duration_ms: Date.now() - startedMs,
        completed: true,
        mode: 'local_direct',
        tool_event_count: 1,
        tool_events: [{
            toolLabel: `Read file ${targetFile}`,
            toolState: 'completed',
        }],
        used_preloaded_read_file: true,
        file_line_count: lines.length,
        excerpt_line_range: {
            start: excerptStartIndex + 1,
            end: lines.length,
        },
        response_preview: content.slice(0, 500),
        max_tokens: request.maxTokens,
        timings: completion.json?.timings || null,
    }
}

async function runWebSocketBenchmark({ wsUrl, request }) {
    return await new Promise((resolve, reject) => {
        const startedAt = new Date().toISOString()
        const startedMs = Date.now()
        const toolEvents = []
        let completed = false
        let settled = false

        const socket = new WebSocket(wsUrl)
        const timeout = setTimeout(() => {
            if (settled) {
                return
            }
            settled = true
            socket.close()
            reject(new Error(`Benchmark timed out waiting for prompt completion via ${wsUrl}`))
        }, 120000)

        socket.on('open', () => {
            socket.send(JSON.stringify(request))
        })

        socket.on('message', (raw) => {
            try {
                const message = JSON.parse(raw.toString())
                if (message?.conversationId !== request.conversationId) {
                    return
                }

                if (message.type === 'prompt_tool') {
                    toolEvents.push({
                        toolLabel: message.toolLabel || null,
                        toolState: message.toolState || null,
                    })
                    return
                }

                if (message.type === 'prompt_complete') {
                    if (settled) {
                        return
                    }
                    settled = true
                    completed = true
                    clearTimeout(timeout)
                    socket.close()
                    resolve({
                        generated_at: new Date().toISOString(),
                        started_at: startedAt,
                        duration_ms: Date.now() - startedMs,
                        completed,
                        mode: 'ws',
                        tool_event_count: toolEvents.length,
                        tool_events: toolEvents,
                        used_preloaded_read_file: toolEvents.some((event) => event.toolLabel === `Read file ${targetFile}`),
                        response_preview: String(message.content || '').slice(0, 500),
                        max_tokens: request.maxTokens,
                    })
                    return
                }

                if (message.type === 'prompt_error') {
                    if (settled) {
                        return
                    }
                    settled = true
                    clearTimeout(timeout)
                    socket.close()
                    reject(new Error(message.error || 'Benchmark prompt failed.'))
                }
            } catch {
                // Ignore unrelated or malformed socket events.
            }
        })

        socket.on('error', (error) => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timeout)
            reject(error)
        })

        socket.on('close', () => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timeout)
            reject(new Error('Benchmark socket closed before completion.'))
        })
    })
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
