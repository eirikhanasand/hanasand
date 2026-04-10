import config from '#constants'
import { getModelState, updateModelState } from '#utils/modelState.ts'
import searchWeb from '#utils/tools/searchWeb.ts'

const TOOL_SYSTEM_PROMPT = [
    'You are Hanasand, a local coding and research assistant.',
    'You can use one external tool called search_web for current or web-dependent information.',
    'When you need that tool, reply with only this XML block and nothing else:',
    '<tool_call>{"name":"search_web","arguments":{"query":"...","limit":5,"visitTopResults":3}}</tool_call>',
    'Use the tool when the user asks for recent information, live facts, release notes, web pages, or anything that could have changed.',
    'After tool results arrive, use them actively in your answer and cite the relevant titles or URLs from the tool output.',
    'If the tool is unnecessary, answer normally.',
].join('\n')

const TOOL_CALL_PATTERN = /<tool_call>\s*([\s\S]+?)\s*<\/tool_call>/i

type ToolCall = {
    name: 'search_web'
    arguments: {
        query: string
        limit?: number
        visitTopResults?: number
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

function withToolSystemPrompt(messages: GPT_ChatMessage[]) {
    const toolPrompt: GPT_ChatMessage = {
        role: 'system',
        content: TOOL_SYSTEM_PROMPT,
    }

    return [toolPrompt, ...messages]
}

function parseToolCall(content: string) {
    const candidates = [
        content.match(TOOL_CALL_PATTERN)?.[1],
        extractBalancedJson(content, '"name":"search_web"'),
        extractBalancedJson(content, '"name": "search_web"'),
    ].filter((candidate): candidate is string => Boolean(candidate))

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate.replace(/^<|>$/g, '').trim()) as ToolCall
            if (parsed?.name === 'search_web' && parsed.arguments?.query) {
                return parsed
            }
        } catch {
            continue
        }
    }

    return null
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

function updateMetricsFromCompletion(response: ChatCompletionResponse) {
    const timings = response.timings
    if (!timings) {
        return
    }

    updateModelState({
        status: 'generating',
        promptTokens: timings.prompt_n || getModelState().promptTokens,
        generatedTokens: timings.predicted_n || getModelState().generatedTokens,
        contextTokens: (timings.cache_n || 0) + (timings.prompt_n || 0) + (timings.predicted_n || 0),
        currentTokens: (timings.prompt_n || 0) + (timings.predicted_n || 0),
        tps: timings.predicted_per_second || getModelState().tps,
    })
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
        }),
    })

    if (!response.ok) {
        throw new Error(`Model request failed with status ${response.status}`)
    }

    const payload = await response.json() as ChatCompletionResponse
    updateMetricsFromCompletion(payload)
    return payload
}

function getMessageContent(response: ChatCompletionResponse) {
    return response.choices?.[0]?.message?.content?.trim() || ''
}

export default async function runModelToolLoop(request: GPT_PromptRequest) {
    const maxIterations = Math.max(0, config.web_search_max_iterations)
    const workingMessages = config.web_search_enabled
        ? withToolSystemPrompt(request.messages)
        : [...request.messages]

    for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
        const completion = await createCompletion(
            config.model_api,
            workingMessages,
            request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 10000,
            request.temperature ?? 0.7,
        )
        const content = getMessageContent(completion)
        const toolCall = config.web_search_enabled ? parseToolCall(content) : null

        if (!toolCall) {
            return content
        }

        const result = await searchWeb({
            query: toolCall.arguments.query,
            limit: toolCall.arguments.limit,
            visitTopResults: toolCall.arguments.visitTopResults,
        })

        workingMessages.push({
            role: 'assistant',
            content,
        })
        workingMessages.push({
            role: 'tool',
            tool_call_id: `search_web_${iteration + 1}`,
            content: [
                `Tool search_web executed for query: ${toolCall.arguments.query}`,
                'Use this result actively. Prefer citing exact titles and URLs that appear below.',
                result.markdown,
            ].join('\n\n'),
        })
    }

    throw new Error('Tool loop exceeded the maximum number of web search iterations.')
}
