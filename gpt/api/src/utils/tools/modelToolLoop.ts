import config from '#constants'
import runCommand from '#utils/tools/runCommand.ts'
import searchWeb from '#utils/tools/searchWeb.ts'

const TOOL_SYSTEM_PROMPT = [
    'You are Hanasand, a local coding assistant that should behave like Codex: concise, practical, markdown-friendly, and action oriented.',
    'You have built-in access to advanced reasoning, live web search, and a sandboxed local command line.',
    'Do not claim you lack internet access, current-date awareness, or shell access when those tools would help.',
    'Use tools aggressively for anything current, verifiable, filesystem-related, package-related, or command-line oriented.',
    'For questions about today, the current date, time, local environment, installed packages, git state, files, logs, or audits, prefer the command tool over guessing.',
    'For recent news, release notes, web content, docs, and changing external facts, prefer the web search tool.',
    'If the user explicitly asks you to search, browse, look something up online, or use your search functionality, you must use search_web.',
    'When you need a tool, reply with only a single XML tool block and nothing else:',
    '<tool_call>{"name":"search_web","arguments":{"query":"...","limit":5,"visitTopResults":3}}</tool_call>',
    '<tool_call>{"name":"run_command","arguments":{"command":"date","cwd":"/optional/path","timeoutMs":120000}}</tool_call>',
    'After a tool result arrives, use it actively in the final answer and cite relevant URLs, commands, or file paths from the tool output.',
    'Answer in Markdown unless the user explicitly wants plain text.',
].join('\n')

const TOOL_CALL_PATTERN = /<tool_call>\s*([\s\S]+?)\s*<\/tool_call>/i

type ToolCall =
    | {
        name: 'search_web'
        arguments: {
            query: string
            limit?: number
            visitTopResults?: number
        }
    }
    | {
        name: 'run_command'
        arguments: {
            command: string
            cwd?: string
            timeoutMs?: number
        }
    }

type ChatCompletionResponse = {
    id?: string
    choices?: Array<{
        message?: {
            content?: string | null
        }
    }>
    timings?: {
        cache_n?: number
        prompt_n?: number
        predicted_n?: number
        predicted_per_second?: number
    }
}

type ToolLoopResult = {
    content: string
    timings?: ChatCompletionResponse['timings']
}

function withToolSystemPrompt(messages: GPT_ChatMessage[]) {
    return [{
        role: 'system',
        content: TOOL_SYSTEM_PROMPT,
    } satisfies GPT_ChatMessage, ...messages]
}

function extractBalancedJson(content: string, marker: string) {
    const markerIndex = content.indexOf(marker)
    if (markerIndex === -1) {
        return null
    }

    let start = markerIndex
    while (start >= 0 && content[start] !== '{') {
        start -= 1
    }

    if (start < 0) {
        return null
    }

    let depth = 0
    for (let index = start; index < content.length; index += 1) {
        const char = content[index]
        if (char === '{') {
            depth += 1
        } else if (char === '}') {
            depth -= 1
            if (depth === 0) {
                return content.slice(start, index + 1)
            }
        }
    }

    return null
}

function parseToolCall(content: string): ToolCall | null {
    const candidates = [
        content.match(TOOL_CALL_PATTERN)?.[1],
        extractBalancedJson(content, '"name":"search_web"'),
        extractBalancedJson(content, '"name": "search_web"'),
        extractBalancedJson(content, '"name":"run_command"'),
        extractBalancedJson(content, '"name": "run_command"'),
    ].filter((candidate): candidate is string => Boolean(candidate))

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate.trim()) as ToolCall
            if (parsed?.name === 'search_web' && parsed.arguments?.query) {
                return parsed
            }
            if (parsed?.name === 'run_command' && parsed.arguments?.command) {
                return parsed
            }
        } catch {
            continue
        }
    }

    const xmlName = content.match(/<name>\s*([^<]+?)\s*<\/name>/i)?.[1]?.trim()
    if (xmlName === 'run_command') {
        const command = content.match(/<command>\s*([\s\S]*?)\s*<\/command>/i)?.[1]?.trim()
        const cwd = content.match(/<cwd>\s*([\s\S]*?)\s*<\/cwd>/i)?.[1]?.trim()
        const timeoutRaw = content.match(/<timeoutMs>\s*(\d+)\s*<\/timeoutMs>/i)?.[1]
        if (command) {
            return {
                name: 'run_command',
                arguments: {
                    command,
                    cwd: cwd || undefined,
                    timeoutMs: timeoutRaw ? Number(timeoutRaw) : undefined,
                },
            }
        }
    }

    if (xmlName === 'search_web') {
        const query = content.match(/<query>\s*([\s\S]*?)\s*<\/query>/i)?.[1]?.trim()
        const limitRaw = content.match(/<limit>\s*(\d+)\s*<\/limit>/i)?.[1]
        const visitTopResultsRaw = content.match(/<visitTopResults>\s*(\d+)\s*<\/visitTopResults>/i)?.[1]
        if (query) {
            return {
                name: 'search_web',
                arguments: {
                    query,
                    limit: limitRaw ? Number(limitRaw) : undefined,
                    visitTopResults: visitTopResultsRaw ? Number(visitTopResultsRaw) : undefined,
                },
            }
        }
    }

    return null
}

function latestUserMessage(messages: GPT_ChatMessage[]) {
    return [...messages].reverse().find((message) => message.role === 'user')?.content || ''
}

async function createCompletion(
    modelUrl: string,
    messages: GPT_ChatMessage[],
    maxTokens: number,
    temperature: number,
) {
    const response = await fetch(`${modelUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer no-key',
        },
        body: JSON.stringify({
            model: 'hanasand',
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: false,
            timings_per_token: true,
            reasoning_format: 'none',
            chat_template_kwargs: {
                enable_thinking: true,
            },
        }),
    })

    if (!response.ok) {
        throw new Error(`Model request failed with status ${response.status}`)
    }

    return await response.json() as ChatCompletionResponse
}

function getMessageContent(response: ChatCompletionResponse) {
    return response.choices?.[0]?.message?.content?.trim() || ''
}

async function executeToolCall(toolCall: ToolCall, iteration: number): Promise<GPT_ChatMessage> {
    if (toolCall.name === 'search_web') {
        const result = await searchWeb({
            query: toolCall.arguments.query,
            limit: toolCall.arguments.limit,
            visitTopResults: toolCall.arguments.visitTopResults,
        })

        return {
            role: 'tool',
            tool_call_id: `search_web_${iteration + 1}`,
            content: [
                `Tool search_web executed for query: ${toolCall.arguments.query}`,
                'Use this result actively and cite relevant URLs from it.',
                result.markdown,
            ].join('\n\n'),
        }
    }

    const result = await runCommand({
        command: toolCall.arguments.command,
        cwd: toolCall.arguments.cwd,
        timeoutMs: toolCall.arguments.timeoutMs,
    })

    return {
        role: 'tool',
        tool_call_id: `run_command_${iteration + 1}`,
        content: [
            `Tool run_command executed: ${result.command}`,
            `Working directory: ${result.cwd}`,
            `Exit code: ${result.exitCode ?? 'null'}`,
            `Timed out: ${result.timedOut ? 'yes' : 'no'}`,
            result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
            result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
        ].join('\n\n'),
    }
}

export default async function runModelToolLoop(request: GPT_PromptRequest): Promise<ToolLoopResult> {
    const maxIterations = Math.max(0, config.web_search_max_iterations + 2)
    const workingMessages = withToolSystemPrompt(request.messages)
    const executedToolCalls = new Set<string>()

    for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
        const completion = await createCompletion(
            config.model_api,
            workingMessages,
            request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000,
            request.temperature ?? 0.7,
        )
        const content = getMessageContent(completion)
        let toolCall = parseToolCall(content)
        const explicitSearchRequested = /(search|browse|look up|lookup|online|web)/i.test(latestUserMessage(workingMessages))
        const alreadyHasToolResult = workingMessages.some((message) => message.role === 'tool')
        if (!alreadyHasToolResult && explicitSearchRequested && (!toolCall || toolCall.name !== 'search_web')) {
            toolCall = {
                name: 'search_web',
                arguments: {
                    query: latestUserMessage(workingMessages),
                    limit: 5,
                    visitTopResults: 3,
                },
            }
        }

        if (!toolCall) {
            return {
                content,
                timings: completion.timings,
            }
        }

        const toolKey = JSON.stringify(toolCall)
        if (executedToolCalls.has(toolKey)) {
            workingMessages.push({
                role: 'system',
                content: 'You already have the requested tool result. Do not call the same tool again. Write the final answer now using the existing tool output.',
            })
            continue
        }

        const toolMessage = await executeToolCall(toolCall, iteration)
        executedToolCalls.add(toolKey)
        workingMessages.push({
            role: 'assistant',
            content,
        })
        workingMessages.push(toolMessage)
        workingMessages.push({
            role: 'system',
            content: 'The tool has finished successfully. Use the tool result above and answer the user now. Do not request the same tool again unless the previous output was clearly insufficient.',
        })
    }

    throw new Error('Tool loop exceeded the maximum number of search/command iterations.')
}
