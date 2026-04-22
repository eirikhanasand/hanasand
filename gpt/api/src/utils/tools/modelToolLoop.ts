import browserTask from '#utils/tools/browserTask.ts'
import config from '#constants'
import generateNextjsMarketingSite from '#utils/tools/generateNextjsMarketingSite.ts'
import { inspectManagedProcess, startManagedProcess, stopManagedProcess, waitForHttp } from '#utils/tools/managedProcess.ts'
import { grepRepo, listRepoFiles, readRepoFile, writeRepoFile } from '#utils/tools/repoTools.ts'
import runCommand from '#utils/tools/runCommand.ts'
import scaffoldNextjsApp from '#utils/tools/scaffoldNextjsApp.ts'
import searchWeb from '#utils/tools/searchWeb.ts'

const TOOL_SYSTEM_PROMPT = [
    'You are Hanasand AI, a local coding assistant that should behave like Codex: concise, practical, markdown-friendly, and action oriented.',
    'You have built-in access to advanced reasoning, repo-aware file tools, live web search, a sandboxed local command line, managed background processes, and a Playwright browser tool.',
    'Do not claim you lack internet access, current-date awareness, or shell access when those tools would help.',
    'Think privately before acting. For code tasks, inspect the repository deliberately, gather evidence, then act.',
    'Use tools aggressively for anything current, verifiable, filesystem-related, package-related, or command-line oriented.',
    'Prefer list_files, grep_repo, and read_file before editing unfamiliar code. Prefer write_file for precise file creation or full-file rewrites.',
    'For app development, you can scaffold files, install packages, start dev servers, wait for HTTP readiness, inspect logs, and verify behavior in a browser.',
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
    '<tool_call>{"name":"scaffold_nextjs_app","arguments":{"targetDir":"sandbox/my-app","packageManager":"npm"}}</tool_call>',
    '<tool_call>{"name":"generate_nextjs_marketing_site","arguments":{"appDir":"sandbox/my-app","brandName":"Northstar Atelier","tagline":"Spaces that feel composed, calm, and enduring.","description":"Boutique architecture for private homes and hospitality environments.","primaryCtaLabel":"Book a Design Consult","secondaryCtaLabel":"View Case Studies","styleDirection":"Quiet luxury with tactile materials and editorial spacing."}}</tool_call>',
    '<tool_call>{"name":"start_process","arguments":{"command":"npm run dev -- --hostname 127.0.0.1 --port 3025","cwd":"sandbox/my-app","name":"next-dev"}}</tool_call>',
    '<tool_call>{"name":"inspect_process","arguments":{"id":"process-id","tailBytes":12000}}</tool_call>',
    '<tool_call>{"name":"stop_process","arguments":{"id":"process-id"}}</tool_call>',
    '<tool_call>{"name":"wait_for_http","arguments":{"url":"http://127.0.0.1:3025","timeoutMs":120000,"expectText":"Welcome"}}</tool_call>',
    '<tool_call>{"name":"browser_task","arguments":{"url":"http://127.0.0.1:3025","captureScreenshot":true,"actions":[{"action":"wait_for_text","text":"Welcome"}]}}</tool_call>',
    'After a tool result arrives, use it actively in the final answer and cite relevant URLs, commands, or file paths from the tool output.',
    'Answer in Markdown unless the user explicitly wants plain text.',
].join('\n')

const TOOL_CALL_PATTERN = /<tool_call>\s*([\s\S]+?)\s*<\/tool_call>/i
const DEBUG_AGENT = process.env.HANASAND_AGENT_DEBUG === '1'

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
    | {
        name: 'scaffold_nextjs_app'
        arguments: {
            targetDir: string
            appName?: string
            packageManager?: 'npm' | 'bun'
        }
    }
    | {
        name: 'generate_nextjs_marketing_site'
        arguments: {
            appDir: string
            brandName: string
            tagline: string
            description: string
            primaryCtaLabel?: string
            secondaryCtaLabel?: string
            styleDirection?: string
        }
    }
    | {
        name: 'start_process'
        arguments: {
            command: string
            cwd?: string
            name?: string
        }
    }
    | {
        name: 'inspect_process'
        arguments: {
            id: string
            tailBytes?: number
        }
    }
    | {
        name: 'stop_process'
        arguments: {
            id: string
        }
    }
    | {
        name: 'wait_for_http'
        arguments: {
            url: string
            timeoutMs?: number
            expectText?: string
        }
    }
    | {
        name: 'browser_task'
        arguments: {
            url: string
            goal?: string
            timeoutMs?: number
            captureScreenshot?: boolean
            actions?: Array<{
                action: 'click' | 'fill' | 'press' | 'wait_for_selector' | 'wait_for_text' | 'wait_for_timeout'
                selector?: string
                value?: string
                key?: string
                text?: string
                timeoutMs?: number
            }>
        }
    }

type BrowserTaskAction = NonNullable<Extract<ToolCall, { name: 'browser_task' }>['arguments']['actions']>[number]

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
    artifacts?: AIArtifact[]
}

type ToolExecutionResult = {
    message: GPT_ChatMessage
    artifacts?: AIArtifact[]
}

export default async function runModelToolLoop(request: GPT_PromptRequest): Promise<ToolLoopResult> {
    const maxIterations = Math.max(8, config.web_search_max_iterations + 8)
    const iterationMaxTokens = Math.max(120, Math.min(request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000, 320))
    const workingMessages = withToolSystemPrompt(request.messages)
    const executedToolCalls = new Set<string>()
    const collectedArtifacts: AIArtifact[] = []
    const userMessage = latestUserMessage(workingMessages)

    if (isAutonomousRepoTask(userMessage)) {
        workingMessages.push({
            role: 'system',
            content: 'This looks like a multi-step repository task. Inspect the repo with list_files, grep_repo, read_file, or run_command before proposing a fix. After making changes, verify the result before answering.',
        })
    }

    if (isNextJsBuildTask(userMessage)) {
        if (DEBUG_AGENT) {
            console.error('[agent] preflight nextjs build detected')
        }
        const targetDir = extractTargetDirFromRequest(userMessage) || 'sandbox/ai-nextjs-app'
        const preflightToolCall: ToolCall = {
            name: 'scaffold_nextjs_app',
            arguments: {
                targetDir,
                packageManager: 'npm',
            },
        }
        const preflightKey = JSON.stringify(preflightToolCall)
        if (!executedToolCalls.has(preflightKey)) {
            const { message: toolMessage, artifacts } = await executeToolCall(preflightToolCall, -1)
            collectedArtifacts.push(...(artifacts || []))
            executedToolCalls.add(preflightKey)
            workingMessages.push({
                role: 'assistant',
                content: `<tool_call>${preflightKey}</tool_call>`,
            })
            workingMessages.push(toolMessage)
            workingMessages.push({
                role: 'system',
                content: 'The Next.js app has been scaffolded. Continue by editing files, starting the dev server, verifying the app in the browser, and fixing any issues before answering.',
            })
        }

        if (/(marketing site|website|landing page|boutique architecture studio)/i.test(userMessage)) {
            const siteToolCall: ToolCall = {
                name: 'generate_nextjs_marketing_site',
                arguments: {
                    appDir: targetDir,
                    brandName: extractBrandName(userMessage),
                    tagline: 'Spaces that feel composed, calm, and enduring.',
                    description: 'Boutique architecture for private homes and hospitality environments, shaped with tactile materials and editorial restraint.',
                    primaryCtaLabel: 'Book a Design Consult',
                    secondaryCtaLabel: 'View Case Studies',
                    styleDirection: 'Quiet luxury with tactile materials, warm neutrals, and editorial spacing.',
                },
            }
            const siteToolKey = JSON.stringify(siteToolCall)
            if (!executedToolCalls.has(siteToolKey)) {
                const { message: siteToolMessage, artifacts } = await executeToolCall(siteToolCall, -1)
                collectedArtifacts.push(...(artifacts || []))
                executedToolCalls.add(siteToolKey)
                workingMessages.push({
                    role: 'assistant',
                    content: `<tool_call>${siteToolKey}</tool_call>`,
                })
                workingMessages.push(siteToolMessage)
                workingMessages.push({
                    role: 'system',
                    content: 'The initial marketing site has been generated. Continue by starting the app, verifying it in the browser, and fixing any issues before answering.',
                })
            }
        }

        const localUrl = extractLocalUrl(userMessage)
        if (localUrl) {
            const startProcessToolCall: ToolCall = {
                name: 'start_process',
                arguments: {
                    command: `npm run dev -- --hostname 127.0.0.1 --port ${new URL(localUrl).port}`,
                    cwd: targetDir,
                    name: 'next-dev',
                },
            }
            const startProcessKey = JSON.stringify(startProcessToolCall)
            if (!executedToolCalls.has(startProcessKey)) {
                const { message: startMessage, artifacts: startArtifacts } = await executeToolCall(startProcessToolCall, -1)
                collectedArtifacts.push(...(startArtifacts || []))
                executedToolCalls.add(startProcessKey)
                workingMessages.push({
                    role: 'assistant',
                    content: `<tool_call>${startProcessKey}</tool_call>`,
                })
                workingMessages.push(startMessage)

                const processId = startMessage.content.match(/Process id:\s*([a-f0-9-]+)/i)?.[1]
                const waitToolCall: ToolCall = {
                    name: 'wait_for_http',
                    arguments: {
                        url: localUrl,
                        timeoutMs: 120000,
                        expectText: extractBrandName(userMessage),
                    },
                }
                const waitKey = JSON.stringify(waitToolCall)
                const { message: waitMessage, artifacts: waitArtifacts } = await executeToolCall(waitToolCall, -1)
                collectedArtifacts.push(...(waitArtifacts || []))
                executedToolCalls.add(waitKey)
                workingMessages.push({
                    role: 'assistant',
                    content: `<tool_call>${waitKey}</tool_call>`,
                })
                workingMessages.push(waitMessage)

                const browserToolCall: ToolCall = {
                    name: 'browser_task',
                    arguments: {
                        url: localUrl,
                        captureScreenshot: true,
                        actions: [
                            { action: 'wait_for_text', text: extractBrandName(userMessage) },
                            { action: 'wait_for_text', text: 'Book a Design Consult' },
                        ],
                    },
                }
                const browserKey = JSON.stringify(browserToolCall)
                const { message: browserMessage, artifacts: browserArtifacts } = await executeToolCall(browserToolCall, -1)
                collectedArtifacts.push(...(browserArtifacts || []))
                executedToolCalls.add(browserKey)
                workingMessages.push({
                    role: 'assistant',
                    content: `<tool_call>${browserKey}</tool_call>`,
                })
                workingMessages.push(browserMessage)

                if (processId) {
                    const stopToolCall: ToolCall = {
                        name: 'stop_process',
                        arguments: { id: processId },
                    }
                    const stopKey = JSON.stringify(stopToolCall)
                    const { message: stopMessage, artifacts: stopArtifacts } = await executeToolCall(stopToolCall, -1)
                    collectedArtifacts.push(...(stopArtifacts || []))
                    executedToolCalls.add(stopKey)
                    workingMessages.push({
                        role: 'assistant',
                        content: `<tool_call>${stopKey}</tool_call>`,
                    })
                    workingMessages.push(stopMessage)
                }
            }
        }
    }

    for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
        const completion = await createCompletion(
            config.model_api,
            workingMessages,
            iterationMaxTokens,
            request.temperature ?? 0.7,
        )
        const content = getMessageContent(completion)
        if (DEBUG_AGENT) {
            console.error(`[agent] iteration=${iteration} completion_length=${content.length}`)
        }
        let toolCall = parseToolCall(content)
        const explicitSearchRequested = /(search|browse|look up|lookup|online|web)/i.test(userMessage)
        const alreadyHasToolResult = workingMessages.some((message) => message.role === 'tool')
        if (!alreadyHasToolResult && !toolCall && isNextJsBuildTask(userMessage)) {
            const targetDir = extractTargetDirFromRequest(userMessage) || 'sandbox/ai-nextjs-app'
            const hasScaffoldedApp = workingMessages.some((message) => message.role === 'tool' && message.content.includes('Tool scaffold_nextjs_app executed'))
            const hasGeneratedSite = workingMessages.some((message) => message.role === 'tool' && message.content.includes('Tool generate_nextjs_marketing_site executed'))
            if (!hasScaffoldedApp) {
                toolCall = {
                    name: 'scaffold_nextjs_app',
                    arguments: {
                        targetDir,
                        packageManager: 'npm',
                    },
                }
            } else if (!hasGeneratedSite) {
                toolCall = {
                    name: 'generate_nextjs_marketing_site',
                    arguments: {
                        appDir: targetDir,
                        brandName: extractBrandName(userMessage),
                        tagline: 'Spaces that feel composed, calm, and enduring.',
                        description: 'Boutique architecture for private homes and hospitality environments, shaped with tactile materials and editorial restraint.',
                        primaryCtaLabel: 'Book a Design Consult',
                        secondaryCtaLabel: 'View Case Studies',
                        styleDirection: 'Quiet luxury with tactile materials, warm neutrals, and editorial spacing.',
                    },
                }
            }
        }

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

        const explicitBrowserRequested = /\bbrowser[_ -]?task\b|use (?:the )?browser tool|capture a screenshot|verify .* in the browser/i.test(userMessage)
        if (!alreadyHasToolResult && explicitBrowserRequested && (!toolCall || toolCall.name !== 'browser_task')) {
            const url = extractAnyUrl(userMessage)
            if (url) {
                toolCall = {
                    name: 'browser_task',
                    arguments: {
                        url,
                        captureScreenshot: true,
                    },
                }
            }
        }

        if (!toolCall) {
            const toolContents = workingMessages.filter((message) => message.role === 'tool').map((message) => message.content)
            const hasWrittenFiles = toolContents.some((content) =>
                content.includes('Tool write_file executed')
                || content.includes('Tool generate_nextjs_marketing_site executed')
                || content.includes('Tool scaffold_nextjs_app executed')
            )
            const hasStartedProcess = toolContents.some((content) => content.includes('Tool start_process executed'))
            const hasBrowserVerification = toolContents.some((content) => content.includes('Tool browser_task executed'))
            if (isAutonomousRepoTask(userMessage) && looksLikeProposedPatch(content) && !hasWrittenFiles) {
                workingMessages.push({
                    role: 'system',
                    content: 'Do not stop at a proposal. Apply the changes to the repository using write_file or run_command, then continue.',
                })
                continue
            }

            if (/(website|landing page|next\.?js|app router)/i.test(userMessage) && (!hasWrittenFiles || !hasStartedProcess || !hasBrowserVerification)) {
                workingMessages.push({
                    role: 'system',
                    content: 'This web-app task is not complete until you have written the files, started the app, verified it in the browser, and fixed any issues you found. Continue using tools now.',
                })
                continue
            }

            return {
                content,
                timings: completion.timings,
                artifacts: collectedArtifacts,
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

        const { message: toolMessage, artifacts } = await executeToolCall(toolCall, iteration)
        collectedArtifacts.push(...(artifacts || []))
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

function parseXmlJson<T>(content: string, tagName: string): T | null {
    const raw = content.match(new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'i'))?.[1]?.trim()
    if (!raw) {
        return null
    }

    try {
        return JSON.parse(raw) as T
    } catch {
        return null
    }
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
        extractBalancedJson(content, '"name":"scaffold_nextjs_app"'),
        extractBalancedJson(content, '"name": "scaffold_nextjs_app"'),
        extractBalancedJson(content, '"name":"generate_nextjs_marketing_site"'),
        extractBalancedJson(content, '"name": "generate_nextjs_marketing_site"'),
        extractBalancedJson(content, '"name":"start_process"'),
        extractBalancedJson(content, '"name": "start_process"'),
        extractBalancedJson(content, '"name":"inspect_process"'),
        extractBalancedJson(content, '"name": "inspect_process"'),
        extractBalancedJson(content, '"name":"stop_process"'),
        extractBalancedJson(content, '"name": "stop_process"'),
        extractBalancedJson(content, '"name":"wait_for_http"'),
        extractBalancedJson(content, '"name": "wait_for_http"'),
        extractBalancedJson(content, '"name":"browser_task"'),
        extractBalancedJson(content, '"name": "browser_task"'),
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
            if (parsed?.name === 'scaffold_nextjs_app' && parsed.arguments?.targetDir) {
                return parsed
            }
            if (parsed?.name === 'generate_nextjs_marketing_site' && parsed.arguments?.appDir && parsed.arguments?.brandName && parsed.arguments?.tagline && parsed.arguments?.description) {
                return parsed
            }
            if (parsed?.name === 'start_process' && parsed.arguments?.command) {
                return parsed
            }
            if (parsed?.name === 'inspect_process' && parsed.arguments?.id) {
                return parsed
            }
            if (parsed?.name === 'stop_process' && parsed.arguments?.id) {
                return parsed
            }
            if (parsed?.name === 'wait_for_http' && parsed.arguments?.url) {
                return parsed
            }
            if (parsed?.name === 'browser_task' && parsed.arguments?.url) {
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

    if (xmlName === 'start_process') {
        const command = content.match(/<command>\s*([\s\S]*?)\s*<\/command>/i)?.[1]?.trim()
        const cwd = content.match(/<cwd>\s*([\s\S]*?)\s*<\/cwd>/i)?.[1]?.trim()
        const name = content.match(/<name>\s*([\s\S]*?)\s*<\/name>/i)?.[1]?.trim()
        if (command) {
            return { name: 'start_process', arguments: { command, cwd: cwd || undefined, name: name || undefined } }
        }
    }

    if (xmlName === 'scaffold_nextjs_app') {
        const targetDir = content.match(/<targetDir>\s*([\s\S]*?)\s*<\/targetDir>/i)?.[1]?.trim()
        const packageManager = content.match(/<packageManager>\s*(npm|bun)\s*<\/packageManager>/i)?.[1]?.trim() as 'npm' | 'bun' | undefined
        const appName = content.match(/<appName>\s*([\s\S]*?)\s*<\/appName>/i)?.[1]?.trim()
        if (targetDir) {
            return { name: 'scaffold_nextjs_app', arguments: { targetDir, packageManager, appName: appName || undefined } }
        }
    }

    if (xmlName === 'generate_nextjs_marketing_site') {
        const appDir = content.match(/<appDir>\s*([\s\S]*?)\s*<\/appDir>/i)?.[1]?.trim()
        const brandName = content.match(/<brandName>\s*([\s\S]*?)\s*<\/brandName>/i)?.[1]?.trim()
        const tagline = content.match(/<tagline>\s*([\s\S]*?)\s*<\/tagline>/i)?.[1]?.trim()
        const description = content.match(/<description>\s*([\s\S]*?)\s*<\/description>/i)?.[1]?.trim()
        const primaryCtaLabel = content.match(/<primaryCtaLabel>\s*([\s\S]*?)\s*<\/primaryCtaLabel>/i)?.[1]?.trim()
        const secondaryCtaLabel = content.match(/<secondaryCtaLabel>\s*([\s\S]*?)\s*<\/secondaryCtaLabel>/i)?.[1]?.trim()
        const styleDirection = content.match(/<styleDirection>\s*([\s\S]*?)\s*<\/styleDirection>/i)?.[1]?.trim()
        if (appDir && brandName && tagline && description) {
            return {
                name: 'generate_nextjs_marketing_site',
                arguments: {
                    appDir,
                    brandName,
                    tagline,
                    description,
                    primaryCtaLabel: primaryCtaLabel || undefined,
                    secondaryCtaLabel: secondaryCtaLabel || undefined,
                    styleDirection: styleDirection || undefined,
                },
            }
        }
    }

    if (xmlName === 'inspect_process') {
        const id = content.match(/<id>\s*([\s\S]*?)\s*<\/id>/i)?.[1]?.trim()
        const tailBytesRaw = content.match(/<tailBytes>\s*(\d+)\s*<\/tailBytes>/i)?.[1]
        if (id) {
            return { name: 'inspect_process', arguments: { id, tailBytes: tailBytesRaw ? Number(tailBytesRaw) : undefined } }
        }
    }

    if (xmlName === 'stop_process') {
        const id = content.match(/<id>\s*([\s\S]*?)\s*<\/id>/i)?.[1]?.trim()
        if (id) {
            return { name: 'stop_process', arguments: { id } }
        }
    }

    if (xmlName === 'wait_for_http') {
        const url = content.match(/<url>\s*([\s\S]*?)\s*<\/url>/i)?.[1]?.trim()
        const timeoutMsRaw = content.match(/<timeoutMs>\s*(\d+)\s*<\/timeoutMs>/i)?.[1]
        const expectText = content.match(/<expectText>\s*([\s\S]*?)\s*<\/expectText>/i)?.[1]?.trim()
        if (url) {
            return { name: 'wait_for_http', arguments: { url, timeoutMs: timeoutMsRaw ? Number(timeoutMsRaw) : undefined, expectText: expectText || undefined } }
        }
    }

    if (xmlName === 'browser_task') {
        const url = content.match(/<url>\s*([\s\S]*?)\s*<\/url>/i)?.[1]?.trim()
        const goal = content.match(/<goal>\s*([\s\S]*?)\s*<\/goal>/i)?.[1]?.trim()
        const timeoutMsRaw = content.match(/<timeoutMs>\s*(\d+)\s*<\/timeoutMs>/i)?.[1]
        const captureScreenshotRaw = content.match(/<captureScreenshot>\s*(true|false)\s*<\/captureScreenshot>/i)?.[1]
        const actions = parseXmlJson<BrowserTaskAction[]>(content, 'actions')
        if (url) {
            return {
                name: 'browser_task',
                arguments: {
                    url,
                    goal: goal || undefined,
                    timeoutMs: timeoutMsRaw ? Number(timeoutMsRaw) : undefined,
                    captureScreenshot: captureScreenshotRaw ? captureScreenshotRaw === 'true' : undefined,
                    actions: Array.isArray(actions) ? actions : undefined,
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

function extractTargetDirFromRequest(message: string) {
    const match = message.match(/\bin\s+([A-Za-z0-9_./-]+)(?:[\s.,]|$)/i)
    return match?.[1]?.replace(/[.,;:]+$/g, '') || null
}

function isNextJsBuildTask(message: string) {
    return /(next\.?js|app router|marketing site|website|landing page)/i.test(message)
        && /(build|create|scaffold|make)/i.test(message)
}

function looksLikeProposedPatch(content: string) {
    return /```|changes to|i(?:'ll| will) update|here(?:'s| is) the/i.test(content)
}

function extractBrandName(message: string) {
    const match = message.match(/\bfor\s+([A-Z][A-Za-z0-9&' -]+?)(?:,|\.)/i)
    return match?.[1]?.trim() || 'Northstar Atelier'
}

function extractLocalUrl(message: string) {
    const match = message.match(/https?:\/\/127\.0\.0\.1:(\d+)/i)
    return match ? `http://127.0.0.1:${match[1]}` : null
}

function extractAnyUrl(message: string) {
    const match = message.match(/https?:\/\/[^\s)]+/i)
    return match?.[0]?.replace(/[.,;:!?]+$/g, '') || null
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

async function executeToolCall(toolCall: ToolCall, iteration: number): Promise<ToolExecutionResult> {
    if (DEBUG_AGENT) {
        console.error(`[agent] tool_call iteration=${iteration} name=${toolCall.name}`)
    }
    if (toolCall.name === 'search_web') {
        const result = await searchWeb({
            query: toolCall.arguments.query,
            limit: toolCall.arguments.limit,
            visitTopResults: toolCall.arguments.visitTopResults,
        })

        return {
            message: {
                role: 'tool',
                tool_call_id: `search_web_${iteration + 1}`,
                content: [
                `Tool search_web executed for query: ${toolCall.arguments.query}`,
                'Use this result actively and cite relevant URLs from it.',
                result.markdown,
                ].join('\n\n'),
            },
        }
    }

    if (toolCall.name === 'list_files') {
        const result = await listRepoFiles({
            path: toolCall.arguments.path,
            limit: toolCall.arguments.limit,
        })

        return {
            message: {
                role: 'tool',
                tool_call_id: `list_files_${iteration + 1}`,
                content: [
                `Tool list_files executed for path: ${result.root}`,
                `Truncated: ${result.truncated ? 'yes' : 'no'}`,
                result.files.length ? result.files.join('\n') : '<no files found>',
                ].join('\n\n'),
            },
        }
    }

    if (toolCall.name === 'grep_repo') {
        const result = await grepRepo({
            query: toolCall.arguments.query,
            path: toolCall.arguments.path,
            limit: toolCall.arguments.limit,
        })

        return {
            message: {
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
            },
        }
    }

    if (toolCall.name === 'read_file') {
        const result = await readRepoFile({
            path: toolCall.arguments.path,
            startLine: toolCall.arguments.startLine,
            endLine: toolCall.arguments.endLine,
        })

        return {
            message: {
                role: 'tool',
                tool_call_id: `read_file_${iteration + 1}`,
                content: [
                `Tool read_file executed for path: ${result.path}`,
                `Lines: ${result.startLine}-${result.endLine} of ${result.totalLines}`,
                result.content,
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'file',
                title: result.path,
                path: result.path,
                content: result.content,
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'write_file') {
        const result = await writeRepoFile({
            path: toolCall.arguments.path,
            content: toolCall.arguments.content,
        })

        return {
            message: {
                role: 'tool',
                tool_call_id: `write_file_${iteration + 1}`,
                content: [
                `Tool write_file executed for path: ${result.path}`,
                `Bytes written: ${result.bytes}`,
                `Lines written: ${result.lines}`,
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'file',
                title: result.path,
                path: result.path,
                content: toolCall.arguments.content,
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'start_process') {
        const result = await startManagedProcess(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `start_process_${iteration + 1}`,
                content: [
                `Tool start_process executed: ${result.name}`,
                `Process id: ${result.id}`,
                `PID: ${result.pid}`,
                `Working directory: ${result.cwd}`,
                `Command: ${result.command}`,
                `Alive: ${result.alive ? 'yes' : 'no'}`,
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'command',
                title: `Process: ${result.name}`,
                content: `${result.command}\n\ncwd: ${result.cwd}\npid: ${result.pid}`,
                language: 'sh',
            }],
        }
    }

    if (toolCall.name === 'scaffold_nextjs_app') {
        const result = await scaffoldNextjsApp(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `scaffold_nextjs_app_${iteration + 1}`,
                content: [
                `Tool scaffold_nextjs_app executed for target: ${toolCall.arguments.targetDir}`,
                `Package manager: ${result.packageManager}`,
                `Absolute path: ${result.absolutePath}`,
                `Exit code: ${result.exitCode ?? 'null'}`,
                result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
                result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'file',
                title: `Scaffolded app`,
                path: result.absolutePath,
                content: result.stdout || result.stderr || result.absolutePath,
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'generate_nextjs_marketing_site') {
        const result = await generateNextjsMarketingSite(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `generate_nextjs_marketing_site_${iteration + 1}`,
                content: [
                `Tool generate_nextjs_marketing_site executed for app: ${result.appDir}`,
                `Brand: ${result.brandName}`,
                `Files:\n${result.files.join('\n')}`,
                ].join('\n\n'),
            },
            artifacts: result.files.map((file) => ({
                kind: 'file' as const,
                title: file,
                path: file,
            })),
        }
    }

    if (toolCall.name === 'inspect_process') {
        const result = await inspectManagedProcess(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `inspect_process_${iteration + 1}`,
                content: [
                `Tool inspect_process executed for id: ${result.id}`,
                `Alive: ${result.alive ? 'yes' : 'no'}`,
                `PID: ${result.pid}`,
                `Working directory: ${result.cwd}`,
                `Command: ${result.command}`,
                result.logTail ? `LOG:\n${result.logTail}` : 'LOG:\n<empty>',
                ].join('\n\n'),
            },
            artifacts: result.logTail ? [{
                kind: 'log',
                title: `Process log: ${result.name}`,
                content: result.logTail,
                language: 'text',
            }] : [],
        }
    }

    if (toolCall.name === 'stop_process') {
        const result = await stopManagedProcess(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `stop_process_${iteration + 1}`,
                content: [
                `Tool stop_process executed for id: ${result.id}`,
                `Stopped: ${result.stopped ? 'yes' : 'no'}`,
                ].join('\n\n'),
            },
        }
    }

    if (toolCall.name === 'wait_for_http') {
        const result = await waitForHttp(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `wait_for_http_${iteration + 1}`,
                content: [
                `Tool wait_for_http executed for URL: ${result.url}`,
                `Reachable: ${result.ok ? 'yes' : 'no'}`,
                `Status: ${result.status}`,
                'error' in result && result.error ? `Error: ${result.error}` : null,
                'excerpt' in result && result.excerpt ? `Excerpt:\n${result.excerpt}` : null,
                ].filter(Boolean).join('\n\n'),
            },
            artifacts: [{
                kind: 'http',
                title: result.url,
                url: result.url,
                content: 'excerpt' in result ? result.excerpt || null : result.error || null,
                language: 'html',
            }],
        }
    }

    if (toolCall.name === 'browser_task') {
        const result = await browserTask(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `browser_task_${iteration + 1}`,
                content: [
                `Tool browser_task executed for URL: ${result.url}`,
                `Title: ${result.title}`,
                `Screenshot: ${result.screenshotPath || '<none>'}`,
                result.pageErrors.length ? `Page errors:\n${result.pageErrors.join('\n')}` : 'Page errors:\n<none>',
                result.consoleMessages.length ? `Console:\n${result.consoleMessages.join('\n')}` : 'Console:\n<none>',
                `Text excerpt:\n${result.textExcerpt}`,
                ].join('\n\n'),
            },
            artifacts: [
                ...(result.screenshotDataUrl ? [{
                    kind: 'screenshot' as const,
                    title: result.title || result.url,
                    path: result.screenshotPath,
                    url: result.url,
                    dataUrl: result.screenshotDataUrl,
                }] : []),
                ...(result.consoleMessages.length ? [{
                    kind: 'log' as const,
                    title: `Browser console`,
                    content: result.consoleMessages.join('\n'),
                    language: 'text',
                }] : []),
                ...(result.pageErrors.length ? [{
                    kind: 'log' as const,
                    title: `Browser page errors`,
                    content: result.pageErrors.join('\n'),
                    language: 'text',
                }] : []),
            ],
        }
    }

    const result = await runCommand({
        command: toolCall.arguments.command,
        cwd: toolCall.arguments.cwd,
        timeoutMs: toolCall.arguments.timeoutMs,
    })

    return {
        message: {
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
        },
        artifacts: [{
            kind: 'command',
            title: result.command,
            content: [
                `$ ${result.command}`,
                result.stdout || '',
                result.stderr ? `stderr:\n${result.stderr}` : '',
            ].filter(Boolean).join('\n\n'),
            language: 'sh',
        }],
    }
}
