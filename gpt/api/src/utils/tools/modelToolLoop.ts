import config from '#constants'
import { grepRepo, listRepoFiles, readRepoFile, writeRepoFile } from '#utils/tools/repoTools.ts'
import runCommand from '#utils/tools/runCommand.ts'
import searchWeb from '#utils/tools/searchWeb.ts'

const TOOL_SYSTEM_PROMPT = [
    'You are Hanasand AI, a local coding assistant that should behave like Codex: concise, practical, markdown-friendly, and action oriented.',
    'You have built-in access to advanced reasoning, repo-aware file tools, live web search, and a sandboxed local command line.',
    'Do not claim you lack internet access, current-date awareness, or shell access when those tools would help.',
    'Think privately before acting. For code tasks, inspect the repository deliberately, gather evidence, then act.',
    'Use tools aggressively for anything current, verifiable, filesystem-related, package-related, or command-line oriented.',
    'Prefer list_files, grep_repo, and read_file before editing unfamiliar code. Prefer write_file for precise file creation or full-file rewrites.',
    'For questions about today, the current date, time, local environment, installed packages, git state, files, logs, or audits, prefer the command tool over guessing.',
    'For recent news, release notes, web content, docs, and changing external facts, prefer the web search tool.',
    'If the user explicitly asks you to search, browse, look something up online, or use your search functionality, you must use search_web.',
    'When you need a tool, reply with only a single XML tool block and nothing else:',
    '<tool_call>{"name":"search_web","arguments":{"query":"...","limit":5,"visitTopResults":3}}</tool_call>',
    '<tool_call>{"name":"list_files","arguments":{"path":"optional/subdir","limit":200}}</tool_call>',
    '<tool_call>{"name":"grep_repo","arguments":{"query":"search text","path":"optional/subdir","limit":60}}</tool_call>',
    '<tool_call>{"name":"read_file","arguments":{"path":"frontend/src/app/page.tsx","startLine":1,"endLine":200}}</tool_call>',
    '<tool_call>{"name":"write_file","arguments":{"path":"notes/output.md","content":"..."}}</tool_call>',
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
        name: 'list_files'
        arguments: {
            path?: string
            limit?: number
        }
    }
    | {
        name: 'grep_repo'
        arguments: {
            query: string
            path?: string
            limit?: number
        }
    }
    | {
        name: 'read_file'
        arguments: {
            path: string
            startLine?: number
            endLine?: number
        }
    }
    | {
        name: 'write_file'
        arguments: {
            path: string
            content: string
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
        extractBalancedJson(content, '"name":"list_files"'),
        extractBalancedJson(content, '"name": "list_files"'),
        extractBalancedJson(content, '"name":"grep_repo"'),
        extractBalancedJson(content, '"name": "grep_repo"'),
        extractBalancedJson(content, '"name":"read_file"'),
        extractBalancedJson(content, '"name": "read_file"'),
        extractBalancedJson(content, '"name":"write_file"'),
        extractBalancedJson(content, '"name": "write_file"'),
        extractBalancedJson(content, '"name":"run_command"'),
        extractBalancedJson(content, '"name": "run_command"'),
    ].filter((candidate): candidate is string => Boolean(candidate))

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate.trim()) as ToolCall
            if (parsed?.name === 'search_web' && parsed.arguments?.query) {
                return parsed
            }
            if (parsed?.name === 'list_files') {
                return parsed
            }
            if (parsed?.name === 'grep_repo' && parsed.arguments?.query) {
                return parsed
            }
            if (parsed?.name === 'read_file' && parsed.arguments?.path) {
                return parsed
            }
            if (parsed?.name === 'write_file' && parsed.arguments?.path && typeof parsed.arguments?.content === 'string') {
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

    if (xmlName === 'list_files') {
        const targetPath = content.match(/<path>\s*([\s\S]*?)\s*<\/path>/i)?.[1]?.trim()
        const limitRaw = content.match(/<limit>\s*(\d+)\s*<\/limit>/i)?.[1]
        return {
            name: 'list_files',
            arguments: {
                path: targetPath || undefined,
                limit: limitRaw ? Number(limitRaw) : undefined,
            },
        }
    }

    if (xmlName === 'grep_repo') {
        const query = content.match(/<query>\s*([\s\S]*?)\s*<\/query>/i)?.[1]?.trim()
        const targetPath = content.match(/<path>\s*([\s\S]*?)\s*<\/path>/i)?.[1]?.trim()
        const limitRaw = content.match(/<limit>\s*(\d+)\s*<\/limit>/i)?.[1]
        if (query) {
            return {
                name: 'grep_repo',
                arguments: {
                    query,
                    path: targetPath || undefined,
                    limit: limitRaw ? Number(limitRaw) : undefined,
                },
            }
        }
    }

    if (xmlName === 'read_file') {
        const targetPath = content.match(/<path>\s*([\s\S]*?)\s*<\/path>/i)?.[1]?.trim()
        const startLineRaw = content.match(/<startLine>\s*(\d+)\s*<\/startLine>/i)?.[1]
        const endLineRaw = content.match(/<endLine>\s*(\d+)\s*<\/endLine>/i)?.[1]
        if (targetPath) {
            return {
                name: 'read_file',
                arguments: {
                    path: targetPath,
                    startLine: startLineRaw ? Number(startLineRaw) : undefined,
                    endLine: endLineRaw ? Number(endLineRaw) : undefined,
                },
            }
        }
    }

    if (xmlName === 'write_file') {
        const targetPath = content.match(/<path>\s*([\s\S]*?)\s*<\/path>/i)?.[1]?.trim()
        const fileContent = content.match(/<content>\s*([\s\S]*?)\s*<\/content>/i)?.[1]
        if (targetPath && typeof fileContent === 'string') {
            return {
                name: 'write_file',
                arguments: {
                    path: targetPath,
                    content: fileContent,
                },
            }
        }
    }

    return null
}

function latestUserMessage(messages: GPT_ChatMessage[]) {
    return [...messages].reverse().find((message) => message.role === 'user')?.content || ''
}

function isAutonomousRepoTask(message: string) {
    return /(fix|implement|debug|investigate|audit|analyze|analyse|refactor|edit|update|patch|search the repo|read the file|look through)/i.test(message)
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

    if (toolCall.name === 'list_files') {
        const result = await listRepoFiles({
            path: toolCall.arguments.path,
            limit: toolCall.arguments.limit,
        })

        return {
            role: 'tool',
            tool_call_id: `list_files_${iteration + 1}`,
            content: [
                `Tool list_files executed for path: ${result.root}`,
                `Truncated: ${result.truncated ? 'yes' : 'no'}`,
                result.files.length ? result.files.join('\n') : '<no files found>',
            ].join('\n\n'),
        }
    }

    if (toolCall.name === 'grep_repo') {
        const result = await grepRepo({
            query: toolCall.arguments.query,
            path: toolCall.arguments.path,
            limit: toolCall.arguments.limit,
        })

        return {
            role: 'tool',
            tool_call_id: `grep_repo_${iteration + 1}`,
            content: [
                `Tool grep_repo executed for query: ${result.query}`,
                `Root: ${result.root}`,
                `Truncated: ${result.truncated ? 'yes' : 'no'}`,
                result.matches.length
                    ? result.matches.map((match) => `${match.path}:${match.line}: ${match.text}`).join('\n')
                    : '<no matches found>',
            ].join('\n\n'),
        }
    }

    if (toolCall.name === 'read_file') {
        const result = await readRepoFile({
            path: toolCall.arguments.path,
            startLine: toolCall.arguments.startLine,
            endLine: toolCall.arguments.endLine,
        })

        return {
            role: 'tool',
            tool_call_id: `read_file_${iteration + 1}`,
            content: [
                `Tool read_file executed for path: ${result.path}`,
                `Lines: ${result.startLine}-${result.endLine} of ${result.totalLines}`,
                result.content,
            ].join('\n\n'),
        }
    }

    if (toolCall.name === 'write_file') {
        const result = await writeRepoFile({
            path: toolCall.arguments.path,
            content: toolCall.arguments.content,
        })

        return {
            role: 'tool',
            tool_call_id: `write_file_${iteration + 1}`,
            content: [
                `Tool write_file executed for path: ${result.path}`,
                `Bytes written: ${result.bytes}`,
                `Lines written: ${result.lines}`,
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
    const maxIterations = Math.max(4, config.web_search_max_iterations + 4)
    const workingMessages = withToolSystemPrompt(request.messages)
    const executedToolCalls = new Set<string>()
    const userMessage = latestUserMessage(workingMessages)

    if (isAutonomousRepoTask(userMessage)) {
        workingMessages.push({
            role: 'system',
            content: 'This looks like a multi-step repository task. Inspect the repo with list_files, grep_repo, read_file, or run_command before proposing a fix. After making changes, verify the result before answering.',
        })
    }

    for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
        const completion = await createCompletion(
            config.model_api,
            workingMessages,
            request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000,
            request.temperature ?? 0.7,
        )
        const content = getMessageContent(completion)
        let toolCall = parseToolCall(content)
        const explicitSearchRequested = /(search|browse|look up|lookup|online|web)/i.test(userMessage)
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
