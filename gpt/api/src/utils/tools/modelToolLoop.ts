import browserTask from '#utils/tools/browserTask.ts'
import { composeDown, composeLogs, composeUp } from '#utils/tools/composeStack.ts'
import config from '#constants'
import generateNextjsMarketingSite from '#utils/tools/generateNextjsMarketingSite.ts'
import httpRequest from '#utils/tools/httpRequest.ts'
import { inspectManagedProcess, startManagedProcess, stopManagedProcess, waitForHttp } from '#utils/tools/managedProcess.ts'
import { batchEditRepoFiles, editRepoFile, grepRepo, listRepoFiles, readRepoFile, writeRepoFile } from '#utils/tools/repoTools.ts'
import runCommand from '#utils/tools/runCommand.ts'
import scaffoldFastifyPostgresApp from '#utils/tools/scaffoldFastifyPostgresApp.ts'
import scaffoldFastifyWorkerRedisApp from '#utils/tools/scaffoldFastifyWorkerRedisApp.ts'
import scaffoldNextjsDockerApp from '#utils/tools/scaffoldNextjsDockerApp.ts'
import scaffoldNextjsApp from '#utils/tools/scaffoldNextjsApp.ts'
import searchWeb from '#utils/tools/searchWeb.ts'

const TOOL_SYSTEM_PROMPT = [
    'You are Hanasand AI, a local coding assistant that should behave like Codex: concise, practical, markdown-friendly, and action oriented.',
    'You have built-in access to advanced reasoning, repo-aware file tools, live web search, a sandboxed local command line, managed background processes, and a Playwright browser tool.',
    'Do not claim you lack internet access, current-date awareness, or shell access when those tools would help.',
    'Think privately before acting. For code tasks, inspect the repository deliberately, gather evidence, then act.',
    'Use tools aggressively for anything current, verifiable, filesystem-related, package-related, or command-line oriented.',
    'Prefer list_files, grep_repo, and read_file before editing unfamiliar code. Prefer edit_file for targeted snippet changes and write_file for precise file creation or full-file rewrites.',
    'For app development, you can scaffold files, install packages, start dev servers, wait for HTTP readiness, inspect logs, and verify behavior in a browser.',
    'When repeated or multi-step work would benefit future tasks, create a reusable script, helper, or tool in the repository instead of repeating the same manual steps.',
    'When working inside the Hanasand repository, read agents/START_HERE.md first. For native app or website-to-app parity work, also read agents/DESKTOP_APP_DEVELOPMENT.md and follow it as the operating playbook.',
    'For requests like "implement the share functionality from the website", independently trace the website component, API helper, backend route, response shape, native app foothold, and verification commands before editing. Do not ask the user for endpoint names or file paths that the repository can reveal.',
    'Prefer durable improvements: if a missing capability blocks the task and can be implemented safely, add the capability, then use it.',
    'For questions about today, the current date, time, local environment, installed packages, git state, files, logs, or audits, prefer the command tool over guessing.',
    'For recent news, release notes, web content, docs, and changing external facts, prefer the web search tool.',
    'If the user explicitly asks you to search, browse, look something up online, or use your search functionality, you must use search_web.',
    'When you need a tool, reply with only a single XML tool block and nothing else:',
    '<tool_call>{"name":"search_web","arguments":{"query":"...","limit":5,"visitTopResults":3}}</tool_call>',
    '<tool_call>{"name":"list_files","arguments":{"path":"optional/subdir","limit":200}}</tool_call>',
    '<tool_call>{"name":"grep_repo","arguments":{"query":"search text","path":"optional/subdir","limit":60}}</tool_call>',
    '<tool_call>{"name":"read_file","arguments":{"path":"frontend/src/app/page.tsx","startLine":1,"endLine":200}}</tool_call>',
    '<tool_call>{"name":"edit_file","arguments":{"path":"frontend/src/app/page.tsx","find":"old snippet","replace":"new snippet","replaceAll":false}}</tool_call>',
    '<tool_call>{"name":"batch_edit_files","arguments":{"edits":[{"path":"file-a.ts","find":"old","replace":"new"},{"path":"file-b.ts","find":"before","replace":"after"}]}}</tool_call>',
    '<tool_call>{"name":"write_file","arguments":{"path":"notes/output.md","content":"..."}}</tool_call>',
    '<tool_call>{"name":"run_command","arguments":{"command":"date","cwd":"/optional/path","timeoutMs":120000}}</tool_call>',
    '<tool_call>{"name":"scaffold_nextjs_app","arguments":{"targetDir":"sandbox/my-app","packageManager":"npm"}}</tool_call>',
    '<tool_call>{"name":"scaffold_nextjs_docker_app","arguments":{"targetDir":"sandbox/my-docker-app"}}</tool_call>',
    '<tool_call>{"name":"scaffold_fastify_postgres_app","arguments":{"targetDir":"sandbox/my-api"}}</tool_call>',
    '<tool_call>{"name":"scaffold_fastify_worker_redis_app","arguments":{"targetDir":"sandbox/my-worker-stack"}}</tool_call>',
    '<tool_call>{"name":"generate_nextjs_marketing_site","arguments":{"appDir":"sandbox/my-app","brandName":"Northstar Atelier","tagline":"Spaces that feel composed, calm, and enduring.","description":"Boutique architecture for private homes and hospitality environments.","primaryCtaLabel":"Book a Design Consult","secondaryCtaLabel":"View Case Studies","styleDirection":"Quiet luxury with tactile materials and editorial spacing."}}</tool_call>',
    '<tool_call>{"name":"start_process","arguments":{"command":"npm run dev -- --hostname 127.0.0.1 --port 3025","cwd":"sandbox/my-app","name":"next-dev"}}</tool_call>',
    '<tool_call>{"name":"inspect_process","arguments":{"id":"process-id","tailBytes":12000}}</tool_call>',
    '<tool_call>{"name":"stop_process","arguments":{"id":"process-id"}}</tool_call>',
    '<tool_call>{"name":"compose_up","arguments":{"cwd":"sandbox/my-app","build":true}}</tool_call>',
    '<tool_call>{"name":"compose_logs","arguments":{"cwd":"sandbox/my-app","tail":200}}</tool_call>',
    '<tool_call>{"name":"compose_down","arguments":{"cwd":"sandbox/my-app"}}</tool_call>',
    '<tool_call>{"name":"wait_for_http","arguments":{"url":"http://127.0.0.1:3025","timeoutMs":120000,"expectText":"Welcome"}}</tool_call>',
    '<tool_call>{"name":"http_request","arguments":{"url":"http://127.0.0.1:3001/health","method":"GET","expectStatus":200,"expectJsonKey":"ok"}}</tool_call>',
    '<tool_call>{"name":"browser_task","arguments":{"url":"http://127.0.0.1:3025","captureScreenshot":true,"actions":[{"action":"wait_for_text","text":"Welcome"}]}}</tool_call>',
    'After a tool result arrives, use it actively in the final answer and cite relevant URLs, commands, or file paths from the tool output.',
    'Clean up helper processes you started once verification is complete.',
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
        name: 'edit_file'
        arguments: {
            path: string
            find: string
            replace: string
            replaceAll?: boolean
        }
    }
    | {
        name: 'batch_edit_files'
        arguments: {
            edits: Array<{
                path: string
                find: string
                replace: string
                replaceAll?: boolean
            }>
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
        name: 'scaffold_nextjs_docker_app'
        arguments: {
            targetDir: string
            appName?: string
        }
    }
    | {
        name: 'scaffold_fastify_postgres_app'
        arguments: {
            targetDir: string
            appName?: string
        }
    }
    | {
        name: 'scaffold_fastify_worker_redis_app'
        arguments: {
            targetDir: string
            appName?: string
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
        name: 'compose_up'
        arguments: {
            cwd: string
            file?: string
            projectName?: string
            build?: boolean
        }
    }
    | {
        name: 'compose_logs'
        arguments: {
            cwd: string
            file?: string
            projectName?: string
            tail?: number
        }
    }
    | {
        name: 'compose_down'
        arguments: {
            cwd: string
            file?: string
            projectName?: string
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
        name: 'http_request'
        arguments: {
            url: string
            method?: string
            headers?: Record<string, string>
            body?: string
            timeoutMs?: number
            expectStatus?: number
            expectText?: string
            expectJsonKey?: string
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
    overhead: {
        iterations: number
        completionCalls: number
        completionMs: number
        toolCalls: number
        toolMs: number
        totalMs: number
    }
}

type ToolExecutionResult = {
    message: GPT_ChatMessage
    artifacts?: AIArtifact[]
}

type ToolProgressEmitter = (event: {
    toolId: string
    toolLabel: string
    toolState: 'running' | 'completed' | 'error'
    toolDetail?: string | null
}) => void

export default async function runModelToolLoop(
    request: GPT_PromptRequest,
    emitToolProgress?: ToolProgressEmitter,
): Promise<ToolLoopResult> {
    const loopStartedAt = Date.now()
    const userMessage = latestUserMessage(request.messages)
    const appParityTrainingTask = isAppParityTrainingTask(userMessage)
    const appParityRequest = appParityTrainingTask || isAppParityRequest(userMessage)
    const autonomousRepoTask = isAutonomousRepoTask(userMessage)
    const readOnlyRepoTask = isReadOnlyRepoTask(userMessage)
    const readOnlySingleFilePath = readOnlyRepoTask ? extractSingleRepoFilePath(userMessage) : null
    const readOnlyConciseAnswer = readOnlyRepoTask && prefersConciseReadOnlyAnswer(userMessage)
    const maxIterations = appParityTrainingTask
        ? 3
        : readOnlyRepoTask
            ? (readOnlySingleFilePath ? 0 : 1)
            : autonomousRepoTask
                ? 3
                : Math.max(8, config.web_search_max_iterations + 8)
    const iterationMaxTokens = appParityTrainingTask
        ? Math.max(240, Math.min(request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000, 360))
        : readOnlyRepoTask
            ? Math.max(
                readOnlyConciseAnswer ? 48 : 80,
                Math.min(
                    request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000,
                    readOnlySingleFilePath && readOnlyConciseAnswer ? 72 : 160,
                ),
            )
            : autonomousRepoTask
                ? Math.max(96, Math.min(request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000, 220))
                : Math.max(120, Math.min(request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000, 320))
    const workingMessages = withToolSystemPrompt(request.messages)
    const executedToolCalls = new Set<string>()
    const collectedArtifacts: AIArtifact[] = []
    const prefersBrowserWorkspace = isBrowserWorkspaceRequest(request.messages)
    let toolCalls = 0
    let toolMs = 0
    let completionCalls = 0
    let completionMs = 0

    async function executeTrackedToolCall(toolCall: ToolCall, iteration: number, progress?: ToolProgressEmitter) {
        const startedAt = Date.now()
        try {
            if (appParityTrainingTask && isMutatingToolCall(toolCall)) {
                return buildBlockedTrainingToolResult(toolCall, iteration, progress)
            }
            return await executeToolCall(toolCall, iteration, progress)
        } finally {
            toolCalls += 1
            toolMs += Date.now() - startedAt
        }
    }

    async function createTrackedCompletion(
        modelUrl: string,
        messages: GPT_ChatMessage[],
        maxTokens: number,
        temperature: number,
    ) {
        const startedAt = Date.now()
        try {
            return await createCompletion(modelUrl, messages, maxTokens, temperature)
        } finally {
            completionCalls += 1
            completionMs += Date.now() - startedAt
        }
    }

    if (autonomousRepoTask) {
        workingMessages.push({
            role: 'system',
            content: appParityTrainingTask
                ? 'This is an app-parity training evaluation. Use the preloaded repository evidence plus read-only tools if needed, prove you can discover the website/API/native app contract yourself, and return a concrete implementation plan. Do not edit files, do not run mutating commands, and do not ask the user for endpoint names, payload shapes, or file paths.'
                : readOnlyRepoTask
                    ? 'This is a read-only repository task. Inspect only the minimum file content needed, then answer directly. Do not keep exploring, do not broaden scope, and do not ask for more tools once you can answer.'
                    : 'This is a tightly scoped repository task. Inspect only the minimum files needed, perform one focused change, verify it, then answer. Do not broaden scope, repeat the same tool, or keep exploring once you have enough information to act.',
        })
    }

    if (appParityRequest) {
        const preflightToolCalls = buildAppParityPreflightToolCalls(userMessage)
        for (const preflightToolCall of preflightToolCalls) {
            const preflightKey = JSON.stringify(preflightToolCall)
            if (executedToolCalls.has(preflightKey)) {
                continue
            }

            try {
                const { message: toolMessage, artifacts } = await executeTrackedToolCall(preflightToolCall, -1, emitToolProgress)
                collectedArtifacts.push(...(artifacts || []))
                executedToolCalls.add(preflightKey)
                workingMessages.push({
                    role: 'assistant',
                    content: `<tool_call>${preflightKey}</tool_call>`,
                })
                workingMessages.push(toolMessage)
            } catch (error) {
                workingMessages.push({
                    role: 'system',
                    content: `App-parity preflight could not read ${describeToolCall(preflightToolCall)}: ${error instanceof Error ? error.message : String(error)}.`,
                })
            }
        }

        workingMessages.push({
            role: 'system',
            content: 'Use the app-parity preflight evidence above before asking for more context. If the user asked for implementation, continue by editing after the evidence is enough; if this is a training evaluation, return the plan and verification evidence without editing.',
        })
    }

    if (readOnlySingleFilePath) {
        const preloadRange = await inferReadOnlyPreloadRange(userMessage, readOnlySingleFilePath)
        const preloadToolCall: ToolCall = {
            name: 'read_file',
            arguments: {
                path: readOnlySingleFilePath,
                startLine: preloadRange?.startLine,
                endLine: preloadRange?.endLine,
            },
        }
        const preloadKey = JSON.stringify(preloadToolCall)
        if (!executedToolCalls.has(preloadKey)) {
            try {
                const { message: toolMessage, artifacts } = await executeToolCall(preloadToolCall, -1, emitToolProgress)
                collectedArtifacts.push(...(artifacts || []))
                executedToolCalls.add(preloadKey)
                workingMessages.push({
                    role: 'assistant',
                    content: `<tool_call>${preloadKey}</tool_call>`,
                })
                workingMessages.push(toolMessage)
                workingMessages.push({
                    role: 'system',
                    content: [
                        `The user asked about exactly one file: ${readOnlySingleFilePath}.`,
                        preloadRange
                            ? `The preloaded excerpt was narrowed to ${preloadRange.startLine}-${preloadRange.endLine} because ${preloadRange.reason}.`
                            : 'The full file was preloaded because no safe narrowing heuristic applied.',
                        readOnlyConciseAnswer
                            ? 'Answer directly from the provided content with only the requested result. Keep it terse and do not add explanation unless the user asked for it.'
                            : 'Answer directly from that file content now. Do not inspect any additional files unless the provided content is clearly insufficient.',
                    ].join(' '),
                })
            } catch {
                workingMessages.push({
                    role: 'system',
                    content: `The requested file path ${readOnlySingleFilePath} could not be preloaded. If you still need repository inspection, keep it minimal.`,
                })
            }
        }
    }

    if (isNextJsBuildTask(userMessage) && !prefersBrowserWorkspace) {
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
            const { message: toolMessage, artifacts } = await executeTrackedToolCall(preflightToolCall, -1, emitToolProgress)
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
                const { message: siteToolMessage, artifacts } = await executeTrackedToolCall(siteToolCall, -1, emitToolProgress)
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
                const { message: startMessage, artifacts: startArtifacts } = await executeTrackedToolCall(startProcessToolCall, -1, emitToolProgress)
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
                const { message: waitMessage, artifacts: waitArtifacts } = await executeTrackedToolCall(waitToolCall, -1, emitToolProgress)
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
                const { message: browserMessage, artifacts: browserArtifacts } = await executeTrackedToolCall(browserToolCall, -1, emitToolProgress)
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
                    const { message: stopMessage, artifacts: stopArtifacts } = await executeTrackedToolCall(stopToolCall, -1, emitToolProgress)
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

    if (isDockerizedNextJsTask(userMessage) && !prefersBrowserWorkspace) {
        const targetDir = extractTargetDirFromRequest(userMessage) || 'sandbox/ai-nextjs-docker-app'
        const scaffoldToolCall: ToolCall = {
            name: 'scaffold_nextjs_docker_app',
            arguments: {
                targetDir,
            },
        }
        const scaffoldKey = JSON.stringify(scaffoldToolCall)
        if (!executedToolCalls.has(scaffoldKey)) {
            const { message: toolMessage, artifacts } = await executeTrackedToolCall(scaffoldToolCall, -1)
            collectedArtifacts.push(...(artifacts || []))
            executedToolCalls.add(scaffoldKey)
            workingMessages.push({ role: 'assistant', content: `<tool_call>${scaffoldKey}</tool_call>` })
            workingMessages.push(toolMessage)
        }

        if (/\bdocker compose\b|\bdockerize\b|run it|start it|verify it/i.test(userMessage)) {
            await executeComposeVerificationFlow({
                workingMessages,
                executedToolCalls,
                collectedArtifacts,
                cwd: targetDir,
                url: 'http://127.0.0.1:3000',
                expectText: pathBaseName(targetDir),
                executeTool: executeTrackedToolCall,
            })
        }
    }

    if (isFastifyPostgresTask(userMessage)) {
        const targetDir = extractTargetDirFromRequest(userMessage) || 'sandbox/ai-fastify-postgres-app'
        const scaffoldToolCall: ToolCall = {
            name: 'scaffold_fastify_postgres_app',
            arguments: {
                targetDir,
            },
        }
        const scaffoldKey = JSON.stringify(scaffoldToolCall)
        if (!executedToolCalls.has(scaffoldKey)) {
            const { message: toolMessage, artifacts } = await executeTrackedToolCall(scaffoldToolCall, -1)
            collectedArtifacts.push(...(artifacts || []))
            executedToolCalls.add(scaffoldKey)
            workingMessages.push({ role: 'assistant', content: `<tool_call>${scaffoldKey}</tool_call>` })
            workingMessages.push(toolMessage)
        }

        if (/\bdocker compose\b|\bpostgres\b|run it|start it|verify it/i.test(userMessage)) {
            await executeComposeVerificationFlow({
                workingMessages,
                executedToolCalls,
                collectedArtifacts,
                cwd: targetDir,
                url: 'http://127.0.0.1:3001/health',
                expectText: 'ok',
                executeTool: executeTrackedToolCall,
            })
        }
    }

    if (isMultiServiceWorkerTask(userMessage)) {
        const targetDir = extractTargetDirFromRequest(userMessage) || 'sandbox/ai-fastify-worker-redis-app'
        const scaffoldToolCall: ToolCall = {
            name: 'scaffold_fastify_worker_redis_app',
            arguments: {
                targetDir,
            },
        }
        const scaffoldKey = JSON.stringify(scaffoldToolCall)
        if (!executedToolCalls.has(scaffoldKey)) {
            const { message: toolMessage, artifacts } = await executeTrackedToolCall(scaffoldToolCall, -1)
            collectedArtifacts.push(...(artifacts || []))
            executedToolCalls.add(scaffoldKey)
            workingMessages.push({ role: 'assistant', content: `<tool_call>${scaffoldKey}</tool_call>` })
            workingMessages.push(toolMessage)
        }

        if (/\bdocker compose\b|\bredis\b|run it|start it|verify it/i.test(userMessage)) {
            await executeComposeVerificationFlow({
                workingMessages,
                executedToolCalls,
                collectedArtifacts,
                cwd: targetDir,
                url: 'http://127.0.0.1:3001/health',
                expectText: 'ok',
                executeTool: executeTrackedToolCall,
            })
        }
    }

    for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
        const completion = await createTrackedCompletion(
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
        if (!alreadyHasToolResult && !toolCall && isNextJsBuildTask(userMessage) && !prefersBrowserWorkspace) {
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
                || content.includes('Tool edit_file executed')
                || content.includes('Tool generate_nextjs_marketing_site executed')
                || content.includes('Tool scaffold_nextjs_app executed')
            )
            const hasStartedProcess = toolContents.some((content) => content.includes('Tool start_process executed'))
            const hasBrowserVerification = toolContents.some((content) => content.includes('Tool browser_task executed'))
            if (autonomousRepoTask && looksLikeProposedPatch(content) && !hasWrittenFiles) {
                workingMessages.push({
                    role: 'system',
                    content: 'Do not stop at a proposal. Apply the changes to the repository using edit_file, write_file, or run_command, then continue.',
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
                overhead: {
                    iterations: iteration + 1,
                    completionCalls,
                    completionMs,
                    toolCalls,
                    toolMs,
                    totalMs: Date.now() - loopStartedAt,
                },
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

        const { message: toolMessage, artifacts } = await executeTrackedToolCall(toolCall, iteration, emitToolProgress)
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
        extractBalancedJson(content, '"name":"edit_file"'),
        extractBalancedJson(content, '"name": "edit_file"'),
        extractBalancedJson(content, '"name":"batch_edit_files"'),
        extractBalancedJson(content, '"name": "batch_edit_files"'),
        extractBalancedJson(content, '"name":"write_file"'),
        extractBalancedJson(content, '"name": "write_file"'),
        extractBalancedJson(content, '"name":"run_command"'),
        extractBalancedJson(content, '"name": "run_command"'),
        extractBalancedJson(content, '"name":"scaffold_nextjs_app"'),
        extractBalancedJson(content, '"name": "scaffold_nextjs_app"'),
        extractBalancedJson(content, '"name":"scaffold_nextjs_docker_app"'),
        extractBalancedJson(content, '"name": "scaffold_nextjs_docker_app"'),
        extractBalancedJson(content, '"name":"scaffold_fastify_postgres_app"'),
        extractBalancedJson(content, '"name": "scaffold_fastify_postgres_app"'),
        extractBalancedJson(content, '"name":"scaffold_fastify_worker_redis_app"'),
        extractBalancedJson(content, '"name": "scaffold_fastify_worker_redis_app"'),
        extractBalancedJson(content, '"name":"generate_nextjs_marketing_site"'),
        extractBalancedJson(content, '"name": "generate_nextjs_marketing_site"'),
        extractBalancedJson(content, '"name":"start_process"'),
        extractBalancedJson(content, '"name": "start_process"'),
        extractBalancedJson(content, '"name":"inspect_process"'),
        extractBalancedJson(content, '"name": "inspect_process"'),
        extractBalancedJson(content, '"name":"stop_process"'),
        extractBalancedJson(content, '"name": "stop_process"'),
        extractBalancedJson(content, '"name":"compose_up"'),
        extractBalancedJson(content, '"name": "compose_up"'),
        extractBalancedJson(content, '"name":"compose_logs"'),
        extractBalancedJson(content, '"name": "compose_logs"'),
        extractBalancedJson(content, '"name":"compose_down"'),
        extractBalancedJson(content, '"name": "compose_down"'),
        extractBalancedJson(content, '"name":"wait_for_http"'),
        extractBalancedJson(content, '"name": "wait_for_http"'),
        extractBalancedJson(content, '"name":"http_request"'),
        extractBalancedJson(content, '"name": "http_request"'),
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
            if (parsed?.name === 'edit_file' && parsed.arguments?.path && typeof parsed.arguments?.find === 'string' && typeof parsed.arguments?.replace === 'string') {
                return parsed
            }
            if (parsed?.name === 'batch_edit_files' && Array.isArray(parsed.arguments?.edits) && parsed.arguments.edits.every((edit) => edit?.path && typeof edit.find === 'string' && typeof edit.replace === 'string')) {
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
            if (parsed?.name === 'scaffold_nextjs_docker_app' && parsed.arguments?.targetDir) {
                return parsed
            }
            if (parsed?.name === 'scaffold_fastify_postgres_app' && parsed.arguments?.targetDir) {
                return parsed
            }
            if (parsed?.name === 'scaffold_fastify_worker_redis_app' && parsed.arguments?.targetDir) {
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
            if (parsed?.name === 'compose_up' && parsed.arguments?.cwd) {
                return parsed
            }
            if (parsed?.name === 'compose_logs' && parsed.arguments?.cwd) {
                return parsed
            }
            if (parsed?.name === 'compose_down' && parsed.arguments?.cwd) {
                return parsed
            }
            if (parsed?.name === 'wait_for_http' && parsed.arguments?.url) {
                return parsed
            }
            if (parsed?.name === 'http_request' && parsed.arguments?.url) {
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

    if (xmlName === 'edit_file') {
        const targetPath = content.match(/<path>\s*([\s\S]*?)\s*<\/path>/i)?.[1]?.trim()
        const find = content.match(/<find>\s*([\s\S]*?)\s*<\/find>/i)?.[1]
        const replace = content.match(/<replace>\s*([\s\S]*?)\s*<\/replace>/i)?.[1]
        const replaceAll = /<replaceAll>\s*true\s*<\/replaceAll>/i.test(content)
        if (targetPath && typeof find === 'string' && typeof replace === 'string') {
            return {
                name: 'edit_file',
                arguments: {
                    path: targetPath,
                    find,
                    replace,
                    replaceAll,
                },
            }
        }
    }

    if (xmlName === 'batch_edit_files') {
        const edits = parseXmlJson<Array<{ path: string, find: string, replace: string, replaceAll?: boolean }>>(content, 'edits')
        if (Array.isArray(edits) && edits.every((edit) => edit?.path && typeof edit.find === 'string' && typeof edit.replace === 'string')) {
            return {
                name: 'batch_edit_files',
                arguments: { edits },
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

    if (xmlName === 'scaffold_nextjs_docker_app') {
        const targetDir = content.match(/<targetDir>\s*([\s\S]*?)\s*<\/targetDir>/i)?.[1]?.trim()
        const appName = content.match(/<appName>\s*([\s\S]*?)\s*<\/appName>/i)?.[1]?.trim()
        if (targetDir) {
            return { name: 'scaffold_nextjs_docker_app', arguments: { targetDir, appName: appName || undefined } }
        }
    }

    if (xmlName === 'scaffold_fastify_postgres_app') {
        const targetDir = content.match(/<targetDir>\s*([\s\S]*?)\s*<\/targetDir>/i)?.[1]?.trim()
        const appName = content.match(/<appName>\s*([\s\S]*?)\s*<\/appName>/i)?.[1]?.trim()
        if (targetDir) {
            return { name: 'scaffold_fastify_postgres_app', arguments: { targetDir, appName: appName || undefined } }
        }
    }

    if (xmlName === 'scaffold_fastify_worker_redis_app') {
        const targetDir = content.match(/<targetDir>\s*([\s\S]*?)\s*<\/targetDir>/i)?.[1]?.trim()
        const appName = content.match(/<appName>\s*([\s\S]*?)\s*<\/appName>/i)?.[1]?.trim()
        if (targetDir) {
            return { name: 'scaffold_fastify_worker_redis_app', arguments: { targetDir, appName: appName || undefined } }
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

    if (xmlName === 'compose_up') {
        const cwd = content.match(/<cwd>\s*([\s\S]*?)\s*<\/cwd>/i)?.[1]?.trim()
        const file = content.match(/<file>\s*([\s\S]*?)\s*<\/file>/i)?.[1]?.trim()
        const projectName = content.match(/<projectName>\s*([\s\S]*?)\s*<\/projectName>/i)?.[1]?.trim()
        const buildRaw = content.match(/<build>\s*(true|false)\s*<\/build>/i)?.[1]
        if (cwd) {
            return { name: 'compose_up', arguments: { cwd, file: file || undefined, projectName: projectName || undefined, build: buildRaw ? buildRaw === 'true' : undefined } }
        }
    }

    if (xmlName === 'compose_logs') {
        const cwd = content.match(/<cwd>\s*([\s\S]*?)\s*<\/cwd>/i)?.[1]?.trim()
        const file = content.match(/<file>\s*([\s\S]*?)\s*<\/file>/i)?.[1]?.trim()
        const projectName = content.match(/<projectName>\s*([\s\S]*?)\s*<\/projectName>/i)?.[1]?.trim()
        const tailRaw = content.match(/<tail>\s*(\d+)\s*<\/tail>/i)?.[1]
        if (cwd) {
            return { name: 'compose_logs', arguments: { cwd, file: file || undefined, projectName: projectName || undefined, tail: tailRaw ? Number(tailRaw) : undefined } }
        }
    }

    if (xmlName === 'compose_down') {
        const cwd = content.match(/<cwd>\s*([\s\S]*?)\s*<\/cwd>/i)?.[1]?.trim()
        const file = content.match(/<file>\s*([\s\S]*?)\s*<\/file>/i)?.[1]?.trim()
        const projectName = content.match(/<projectName>\s*([\s\S]*?)\s*<\/projectName>/i)?.[1]?.trim()
        if (cwd) {
            return { name: 'compose_down', arguments: { cwd, file: file || undefined, projectName: projectName || undefined } }
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

    if (xmlName === 'http_request') {
        const url = content.match(/<url>\s*([\s\S]*?)\s*<\/url>/i)?.[1]?.trim()
        const method = content.match(/<method>\s*([\s\S]*?)\s*<\/method>/i)?.[1]?.trim()
        const body = content.match(/<body>\s*([\s\S]*?)\s*<\/body>/i)?.[1]
        const timeoutMsRaw = content.match(/<timeoutMs>\s*(\d+)\s*<\/timeoutMs>/i)?.[1]
        const expectStatusRaw = content.match(/<expectStatus>\s*(\d+)\s*<\/expectStatus>/i)?.[1]
        const expectText = content.match(/<expectText>\s*([\s\S]*?)\s*<\/expectText>/i)?.[1]?.trim()
        const expectJsonKey = content.match(/<expectJsonKey>\s*([\s\S]*?)\s*<\/expectJsonKey>/i)?.[1]?.trim()
        const headers = parseXmlJson<Record<string, string>>(content, 'headers')
        if (url) {
            return {
                name: 'http_request',
                arguments: {
                    url,
                    method: method || undefined,
                    headers: headers && typeof headers === 'object' ? headers : undefined,
                    body: body || undefined,
                    timeoutMs: timeoutMsRaw ? Number(timeoutMsRaw) : undefined,
                    expectStatus: expectStatusRaw ? Number(expectStatusRaw) : undefined,
                    expectText: expectText || undefined,
                    expectJsonKey: expectJsonKey || undefined,
                },
            }
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

function isBrowserWorkspaceRequest(messages: GPT_ChatMessage[]) {
    return messages.some((message) =>
        message.role === 'system'
        && typeof message.content === 'string'
        && (
            message.content.includes('You are Hanasand AI, an app-style coding assistant inside Hanasand.')
            || message.content.includes('<hanasand-tool>')
        )
    )
}

function isAutonomousRepoTask(message: string) {
    return /(fix|implement|debug|investigate|audit|analyze|analyse|refactor|edit|update|patch|search the repo|read the file|look through)/i.test(message)
}

function isAppParityTrainingTask(message: string) {
    return /app[- ]parity training evaluation|training evaluation.*website.*app|train.*website.*app|share functionality.*training|desktop app improvement drill|desktop ui audit/i.test(message)
}

function isAppParityRequest(message: string) {
    return /(website|web).*?(app|native|desktop)|(?:app|native|desktop).*?(website|web)|share functionality/i.test(message)
}

function buildAppParityPreflightToolCalls(message: string): ToolCall[] {
    const lowerMessage = message.toLowerCase()
    const calls: ToolCall[] = [
        {
            name: 'read_file',
            arguments: {
                path: 'agents/START_HERE.md',
                startLine: 1,
                endLine: 80,
            },
        },
        {
            name: 'read_file',
            arguments: {
                path: 'agents/DESKTOP_APP_DEVELOPMENT.md',
                startLine: 1,
                endLine: 220,
            },
        },
    ]

    if (lowerMessage.includes('share')) {
        calls.push(
            {
                name: 'read_file',
                arguments: {
                    path: 'agents/training-scenarios/share-functionality-port.md',
                    startLine: 1,
                    endLine: 120,
                },
            },
            {
                name: 'grep_repo',
                arguments: {
                    query: 'getUserShares',
                    path: 'frontend/src',
                    limit: 40,
                },
            },
            {
                name: 'grep_repo',
                arguments: {
                    query: 'createShare',
                    path: 'app/src',
                    limit: 40,
                },
            },
        )
    }

    return calls
}

function isReadOnlyRepoTask(message: string) {
    const requestsInspection = /(inspect|read|review|report|list|answer with|tell me|which|what are|do not edit|only read)/i.test(message)
    const requestsMutation = /(fix|implement|refactor|edit|update|patch|write|create|apply|change|move)/i.test(message)
    return requestsInspection && !requestsMutation
}

function isMutatingToolCall(toolCall: ToolCall) {
    return toolCall.name === 'edit_file'
        || toolCall.name === 'batch_edit_files'
        || toolCall.name === 'write_file'
        || toolCall.name === 'run_command'
        || toolCall.name === 'start_process'
        || toolCall.name === 'stop_process'
        || toolCall.name === 'compose_up'
        || toolCall.name === 'compose_down'
        || toolCall.name === 'scaffold_nextjs_app'
        || toolCall.name === 'scaffold_nextjs_docker_app'
        || toolCall.name === 'scaffold_fastify_postgres_app'
        || toolCall.name === 'scaffold_fastify_worker_redis_app'
        || toolCall.name === 'generate_nextjs_marketing_site'
}

function buildBlockedTrainingToolResult(
    toolCall: ToolCall,
    iteration: number,
    emitToolProgress?: ToolProgressEmitter,
): ToolExecutionResult {
    const toolId = `${toolCall.name}_${iteration + 1}_${Date.now()}`
    const toolLabel = describeToolCall(toolCall)
    emitToolProgress?.({
        toolId,
        toolLabel,
        toolState: 'error',
        toolDetail: 'Blocked because app-parity training evaluations are read-only.',
    })

    return {
        message: {
            role: 'tool',
            tool_call_id: `blocked_training_${iteration + 1}`,
            content: [
                `Tool ${toolCall.name} was blocked by app-parity training mode.`,
                'This evaluation is read-only. Continue with list_files, grep_repo, and read_file, then return the implementation plan and verification steps.',
            ].join('\n\n'),
        },
    }
}

function prefersConciseReadOnlyAnswer(message: string) {
    return /(answer with|list|names? of|which|what are|one per line|only the|do not explain)/i.test(message)
}

function extractSingleRepoFilePath(message: string) {
    const matches = [...message.matchAll(/([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|yml|yaml|sh))/g)]
        .map((match) => match[1])
        .filter((value) => !/^https?:\/\//i.test(value))
    const unique = [...new Set(matches)]
    return unique.length === 1 ? unique[0] : null
}

function extractTargetDirFromRequest(message: string) {
    const match = message.match(/\bin\s+([A-Za-z0-9_./-]+)(?:[\s.,]|$)/i)
    return match?.[1]?.replace(/[.,;:]+$/g, '') || null
}

function isNextJsBuildTask(message: string) {
    return /(next\.?js|app router|marketing site|website|landing page)/i.test(message)
        && /(build|create|scaffold|make)/i.test(message)
}

function isDockerizedNextJsTask(message: string) {
    return /(next\.?js|app router)/i.test(message)
        && /(docker|docker compose|dockerize)/i.test(message)
}

function isFastifyPostgresTask(message: string) {
    return /(fastify|postgres|backend api|api service)/i.test(message)
        && /(build|create|scaffold|make|docker|compose)/i.test(message)
}

function isMultiServiceWorkerTask(message: string) {
    return /(worker|queue|redis|multi[- ]service|background job)/i.test(message)
        && /(build|create|scaffold|make|docker|compose|stack)/i.test(message)
}

function pathBaseName(targetDir: string) {
    const trimmed = targetDir.replace(/\/+$/g, '')
    const segments = trimmed.split('/').filter(Boolean)
    return segments.at(-1) || targetDir
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

async function inferReadOnlyPreloadRange(message: string, filePath: string) {
    if (!/after the main exported hook|after the main exported|defined after/i.test(message)) {
        return null
    }

    try {
        const fullFile = await readRepoFile({ path: filePath })
        const lines = fullFile.content.split('\n')
        const exportedHookLine = lines.findIndex((line) => /^\s*export default function use[A-Z0-9_]+/.test(line.trim()))
        if (exportedHookLine === -1) {
            return null
        }

        const firstHelperLine = lines.findIndex((line, index) =>
            index > exportedHookLine
            && /^(function|async function)\s+[A-Za-z0-9_$]+/.test(line.trim()),
        )

        if (firstHelperLine === -1) {
            return null
        }

        return {
            startLine: firstHelperLine + 1,
            endLine: lines.length,
            reason: 'the question explicitly asked for top-level helpers after the exported hook',
        }
    } catch {
        return null
    }
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

function describeToolCall(toolCall: ToolCall) {
    if (toolCall.name === 'read_file') return `Read file ${toolCall.arguments.path}`
    if (toolCall.name === 'edit_file') return `Patched file ${toolCall.arguments.path}`
    if (toolCall.name === 'batch_edit_files') return `Patched ${toolCall.arguments.edits.length} files as one batch`
    if (toolCall.name === 'write_file') return `Updated file ${toolCall.arguments.path}`
    if (toolCall.name === 'grep_repo') return `Searched code for "${toolCall.arguments.query}"`
    if (toolCall.name === 'list_files') return `Listed project files${toolCall.arguments.path ? ` in ${toolCall.arguments.path}` : ''}`
    if (toolCall.name === 'run_command') return `Ran command ${toolCall.arguments.command}`
    if (toolCall.name === 'search_web') return `Searched the web for "${toolCall.arguments.query}"`
    if (toolCall.name === 'scaffold_nextjs_app') return `Scaffolded Next.js app ${toolCall.arguments.targetDir}`
    if (toolCall.name === 'scaffold_fastify_worker_redis_app') return `Scaffolded Fastify worker stack ${toolCall.arguments.targetDir}`
    if (toolCall.name === 'generate_nextjs_marketing_site') return `Generated marketing site in ${toolCall.arguments.appDir}`
    if (toolCall.name === 'start_process') return `Started process ${toolCall.arguments.name || toolCall.arguments.command}`
    if (toolCall.name === 'inspect_process') return `Inspected process ${toolCall.arguments.id}`
    if (toolCall.name === 'stop_process') return `Stopped process ${toolCall.arguments.id}`
    if (toolCall.name === 'wait_for_http') return `Checked ${toolCall.arguments.url}`
    if (toolCall.name === 'http_request') return `Requested ${toolCall.arguments.method || 'GET'} ${toolCall.arguments.url}`
    if (toolCall.name === 'browser_task') return `Opened browser task for ${toolCall.arguments.url}`
    return 'Executed tool'
}

async function executeToolCall(
    toolCall: ToolCall,
    iteration: number,
    emitToolProgress?: ToolProgressEmitter,
): Promise<ToolExecutionResult> {
    if (DEBUG_AGENT) {
        console.error(`[agent] tool_call iteration=${iteration} name=${toolCall.name}`)
    }
    const toolId = `${toolCall.name}_${iteration + 1}_${Date.now()}`
    emitToolProgress?.({
        toolId,
        toolLabel: describeToolCall(toolCall),
        toolState: 'running',
    })
    if (toolCall.name === 'search_web') {
        const result = await searchWeb({
            query: toolCall.arguments.query,
            limit: toolCall.arguments.limit,
            visitTopResults: toolCall.arguments.visitTopResults,
        })
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `Found ${result.results.length} result summaries.`,
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
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `Listed ${result.files.length} files.`,
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
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `Found ${result.matches.length} matching lines.`,
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
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `${result.path} lines ${result.startLine}-${result.endLine}.`,
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

    if (toolCall.name === 'edit_file') {
        const result = await editRepoFile({
            path: toolCall.arguments.path,
            find: toolCall.arguments.find,
            replace: toolCall.arguments.replace,
            replaceAll: toolCall.arguments.replaceAll,
        })
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `${result.path} patched (${result.replacements} replacement${result.replacements === 1 ? '' : 's'}).`,
        })

        return {
            message: {
                role: 'tool',
                tool_call_id: `edit_file_${iteration + 1}`,
                content: [
                    `Tool edit_file executed for path: ${result.path}`,
                    `Replacements: ${result.replacements}`,
                    `Match count: ${result.matchCount}`,
                    result.matchedLines.length ? `Matched lines: ${result.matchedLines.join(', ')}` : null,
                    `Bytes written: ${result.bytes}`,
                    `Lines written: ${result.lines}`,
                    result.previewBefore ? `Preview before:\n${result.previewBefore}` : null,
                    result.previewAfter ? `Preview after:\n${result.previewAfter}` : null,
                ].filter(Boolean).join('\n\n'),
            },
            artifacts: [{
                kind: 'file',
                title: result.path,
                path: result.path,
                content: result.content,
                language: 'text',
            }, {
                kind: 'diff',
                title: `Diff: ${result.path}`,
                path: result.path,
                content: result.diff,
                language: 'diff',
            }],
        }
    }

    if (toolCall.name === 'batch_edit_files') {
        const result = await batchEditRepoFiles({
            edits: toolCall.arguments.edits,
        })
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: result.ok ? 'completed' : 'error',
            toolDetail: result.ok
                ? `${result.editsApplied} edit${result.editsApplied === 1 ? '' : 's'} applied.`
                : `Batch failed after ${result.editsApplied} edit${result.editsApplied === 1 ? '' : 's'}; rollback ${result.rolledBack ? 'completed' : 'not needed'}.`,
        })

        return {
            message: {
                role: 'tool',
                tool_call_id: `batch_edit_files_${iteration + 1}`,
                content: [
                    'Tool batch_edit_files executed',
                    `Requested edits: ${result.editsAttempted}`,
                    `Applied edits: ${result.editsApplied}`,
                    `Rolled back: ${result.rolledBack ? 'yes' : 'no'}`,
                    result.error ? `Error: ${result.error}` : null,
                    result.results.length
                        ? `Files:\n${result.results.map((entry) => `${entry.path} (${entry.replacements} replacement${entry.replacements === 1 ? '' : 's'})`).join('\n')}`
                        : null,
                ].filter(Boolean).join('\n\n'),
            },
            artifacts: result.results.flatMap((entry) => ([{
                kind: 'diff' as const,
                title: `Diff: ${entry.path}`,
                path: entry.path,
                content: entry.diff,
                language: 'diff',
            }])),
        }
    }

    if (toolCall.name === 'write_file') {
        const result = await writeRepoFile({
            path: toolCall.arguments.path,
            content: toolCall.arguments.content,
        })
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `${result.path} updated.`,
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
            }, {
                kind: 'diff',
                title: `Diff: ${result.path}`,
                path: result.path,
                content: result.diff,
                language: 'diff',
            }],
        }
    }

    if (toolCall.name === 'start_process') {
        const result = await startManagedProcess(toolCall.arguments)
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `Started ${result.name} on PID ${result.pid}.`,
        })
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
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `Scaffolded app in ${result.absolutePath}.`,
        })
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
                title: 'Scaffolded app',
                path: result.absolutePath,
                content: result.stdout || result.stderr || result.absolutePath,
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'scaffold_nextjs_docker_app') {
        const result = await scaffoldNextjsDockerApp(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `scaffold_nextjs_docker_app_${iteration + 1}`,
                content: [
                    `Tool scaffold_nextjs_docker_app executed for target: ${toolCall.arguments.targetDir}`,
                    `Absolute path: ${result.absolutePath}`,
                    `Exit code: ${result.exitCode ?? 'null'}`,
                    result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
                    result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'file',
                title: 'Dockerized Next.js app',
                path: result.absolutePath,
                content: result.stdout || result.stderr || result.absolutePath,
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'scaffold_fastify_postgres_app') {
        const result = await scaffoldFastifyPostgresApp(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `scaffold_fastify_postgres_app_${iteration + 1}`,
                content: [
                    `Tool scaffold_fastify_postgres_app executed for target: ${toolCall.arguments.targetDir}`,
                    `Absolute path: ${result.absolutePath}`,
                    `Exit code: ${result.exitCode ?? 'null'}`,
                    result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
                    result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'file',
                title: 'Fastify + Postgres app',
                path: result.absolutePath,
                content: result.stdout || result.stderr || result.absolutePath,
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'scaffold_fastify_worker_redis_app') {
        const result = await scaffoldFastifyWorkerRedisApp(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `scaffold_fastify_worker_redis_app_${iteration + 1}`,
                content: [
                    `Tool scaffold_fastify_worker_redis_app executed for target: ${toolCall.arguments.targetDir}`,
                    `Absolute path: ${result.absolutePath}`,
                    `Exit code: ${result.exitCode ?? 'null'}`,
                    result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
                    result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'file',
                title: 'Fastify + worker + Redis app',
                path: result.absolutePath,
                content: result.stdout || result.stderr || result.absolutePath,
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'generate_nextjs_marketing_site') {
        const result = await generateNextjsMarketingSite(toolCall.arguments)
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `Generated ${result.files.length} files.`,
        })
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
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: `${result.name} is ${result.alive ? 'alive' : 'stopped'}.`,
        })
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
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: result.stopped ? 'Process stopped.' : 'Process was already stopped.',
        })
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

    if (toolCall.name === 'compose_up') {
        const result = await composeUp(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `compose_up_${iteration + 1}`,
                content: [
                    `Tool compose_up executed in: ${toolCall.arguments.cwd}`,
                    `Command: ${result.composeCommand}`,
                    `Exit code: ${result.exitCode ?? 'null'}`,
                    result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
                    result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'command',
                title: 'docker compose up',
                content: [result.composeCommand, result.stdout, result.stderr].filter(Boolean).join('\n\n'),
                language: 'sh',
            }],
        }
    }

    if (toolCall.name === 'compose_logs') {
        const result = await composeLogs(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `compose_logs_${iteration + 1}`,
                content: [
                    `Tool compose_logs executed in: ${toolCall.arguments.cwd}`,
                    `Command: ${result.composeCommand}`,
                    `Exit code: ${result.exitCode ?? 'null'}`,
                    result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
                    result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
                ].join('\n\n'),
            },
            artifacts: [{
                kind: 'log',
                title: 'docker compose logs',
                content: result.stdout || result.stderr || '<empty>',
                language: 'text',
            }],
        }
    }

    if (toolCall.name === 'compose_down') {
        const result = await composeDown(toolCall.arguments)
        return {
            message: {
                role: 'tool',
                tool_call_id: `compose_down_${iteration + 1}`,
                content: [
                    `Tool compose_down executed in: ${toolCall.arguments.cwd}`,
                    `Command: ${result.composeCommand}`,
                    `Exit code: ${result.exitCode ?? 'null'}`,
                    result.stdout ? `STDOUT:\n${result.stdout}` : 'STDOUT:\n<empty>',
                    result.stderr ? `STDERR:\n${result.stderr}` : 'STDERR:\n<empty>',
                ].join('\n\n'),
            },
        }
    }

    if (toolCall.name === 'wait_for_http') {
        const result = await waitForHttp(toolCall.arguments)
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: result.ok ? 'completed' : 'error',
            toolDetail: `${result.url} responded with ${result.status}.`,
        })
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

    if (toolCall.name === 'http_request') {
        const result = await httpRequest(toolCall.arguments)
        const assertionSummary = result.assertions.length
            ? result.assertions.map((assertion) => `${assertion.passed ? 'PASS' : 'FAIL'} ${assertion.name}: ${assertion.detail}`).join('\n')
            : '<none>'
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: result.ok ? 'completed' : 'error',
            toolDetail: `${result.method} ${result.url} -> ${result.status}`,
        })
        return {
            message: {
                role: 'tool',
                tool_call_id: `http_request_${iteration + 1}`,
                content: [
                    `Tool http_request executed: ${result.method} ${result.url}`,
                    `OK: ${result.ok ? 'yes' : 'no'}`,
                    `Status: ${result.status} ${result.statusText}`,
                    `Elapsed: ${result.elapsedMs}ms`,
                    result.contentType ? `Content-Type: ${result.contentType}` : null,
                    `Assertions:\n${assertionSummary}`,
                    result.jsonSummary ? `JSON summary:\n${result.jsonSummary}` : null,
                    result.excerpt ? `Body excerpt:\n${result.excerpt}` : null,
                ].filter(Boolean).join('\n\n'),
            },
            artifacts: [{
                kind: 'http',
                title: `${result.method} ${result.url}`,
                url: result.url,
                content: result.excerpt,
                language: result.contentType?.includes('json') ? 'json' : 'text',
            }],
        }
    }

    if (toolCall.name === 'browser_task') {
        const result = await browserTask(toolCall.arguments)
        emitToolProgress?.({
            toolId,
            toolLabel: describeToolCall(toolCall),
            toolState: 'completed',
            toolDetail: result.title || result.url,
        })
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
                    title: 'Browser console',
                    content: result.consoleMessages.join('\n'),
                    language: 'text',
                }] : []),
                ...(result.pageErrors.length ? [{
                    kind: 'log' as const,
                    title: 'Browser page errors',
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
    emitToolProgress?.({
        toolId,
        toolLabel: describeToolCall(toolCall),
        toolState: result.exitCode === 0 ? 'completed' : 'error',
        toolDetail: `Exit code ${result.exitCode ?? 'null'}.`,
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

async function executeComposeVerificationFlow({
    workingMessages,
    executedToolCalls,
    collectedArtifacts,
    cwd,
    url,
    expectText,
    executeTool,
}: {
    workingMessages: GPT_ChatMessage[]
    executedToolCalls: Set<string>
    collectedArtifacts: AIArtifact[]
    cwd: string
    url: string
    expectText?: string
    executeTool: (toolCall: ToolCall, iteration: number, progress?: ToolProgressEmitter) => Promise<ToolExecutionResult>
}) {
    const verificationSteps: ToolCall[] = [
        {
            name: 'compose_up',
            arguments: {
                cwd,
                build: true,
            },
        },
        {
            name: 'wait_for_http',
            arguments: {
                url,
                timeoutMs: 120000,
                expectText,
            },
        },
        {
            name: 'http_request',
            arguments: {
                url,
                method: 'GET',
                expectStatus: 200,
                expectText,
            },
        },
    ]

    const cleanupSteps: ToolCall[] = [
        {
            name: 'compose_logs',
            arguments: {
                cwd,
                tail: 120,
            },
        },
        {
            name: 'compose_down',
            arguments: {
                cwd,
            },
        },
    ]

    let composeLifecycleStarted = false

    try {
        for (const toolCall of verificationSteps) {
            const key = JSON.stringify(toolCall)
            if (executedToolCalls.has(key)) {
                if (toolCall.name === 'compose_up') {
                    composeLifecycleStarted = true
                }
                continue
            }

            if (toolCall.name === 'compose_up') {
                composeLifecycleStarted = true
            }

            const { message, artifacts } = await executeTool(toolCall, -1)
            executedToolCalls.add(key)
            collectedArtifacts.push(...(artifacts || []))
            workingMessages.push({ role: 'assistant', content: `<tool_call>${key}</tool_call>` })
            workingMessages.push(message)
        }
    } finally {
        for (const toolCall of cleanupSteps) {
            if (!composeLifecycleStarted) {
                break
            }
            const key = JSON.stringify(toolCall)
            if (executedToolCalls.has(key)) {
                continue
            }

            workingMessages.push({ role: 'assistant', content: `<tool_call>${key}</tool_call>` })

            try {
                const { message, artifacts } = await executeTool(toolCall, -1)
                executedToolCalls.add(key)
                collectedArtifacts.push(...(artifacts || []))
                workingMessages.push(message)
            } catch (error) {
                workingMessages.push({
                    role: 'tool',
                    tool_call_id: `${toolCall.name}_cleanup`,
                    content: [
                        `Tool ${toolCall.name} cleanup failed in: ${cwd}`,
                        `Error: ${error instanceof Error ? error.message : String(error)}`,
                    ].join('\n\n'),
                })
            }
        }
    }
}
