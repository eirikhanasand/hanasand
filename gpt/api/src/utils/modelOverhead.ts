import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ModelOverheadStages = {
    renderPromptMs: number
    tokenizePromptMs: number
    fetchContextMs: number
    toolLoopMs: number
    tokenizeOutputMs: number
    syncOutputContextMs: number
    streamEmitMs: number
    totalMs: number
}

type ModelLoopBreakdown = {
    iterations: number
    completionCalls: number
    completionMs: number
    toolCalls: number
    toolMs: number
    totalMs: number
}

type ModelOverheadIntegrity = {
    promptTokensSource: 'tokenize' | 'llama_timing_fallback' | 'missing'
    generatedTokensSource: 'tokenize' | 'llama_timing_fallback' | 'missing'
    warnings: string[]
}

type ModelOverheadSample = {
    sampleId: string
    sampleSource: string
    profileTag: string | null
    recordedAt: string
    conversationId: string
    clientName: string | null
    modelApi: string
    promptMessages: number
    maxTokens: number
    promptTokens: number
    generatedTokens: number
    contextMaxTokens: number
    tps: number
    stages: ModelOverheadStages
    loop: ModelLoopBreakdown
    llama: {
        cache_n: number
        prompt_n: number
        predicted_n: number
        predicted_per_second: number
    }
    integrity: ModelOverheadIntegrity
    derived: {
        nonCompletionMs: number
        nonCompletionShare: number
        nextOptimizationTarget: keyof ModelOverheadStages | 'toolMs' | 'completionMs'
        nextOptimizationReason: string
    }
}

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const API_ROOT = path.resolve(THIS_DIR, '../..')

function getModelOverheadRoot() {
    return path.join(API_ROOT, 'runtime', 'model-overhead')
}

function renderMarkdown(sample: ModelOverheadSample) {
    return [
        '# Model Overhead Latest',
        '',
        `- Sample ID: ${sample.sampleId}`,
        `- Sample source: ${sample.sampleSource}`,
        `- Profile: ${sample.profileTag || 'unspecified'}`,
        `- Recorded at: ${sample.recordedAt}`,
        `- Conversation: ${sample.conversationId}`,
        `- Client: ${sample.clientName || 'local'}`,
        `- Prompt tokens: ${sample.promptTokens}`,
        `- Prompt token source: ${sample.integrity.promptTokensSource}`,
        `- Generated tokens: ${sample.generatedTokens}`,
        `- Generated token source: ${sample.integrity.generatedTokensSource}`,
        `- TPS: ${sample.tps}`,
        `- Next optimization target: ${sample.derived.nextOptimizationTarget}`,
        `- Reason: ${sample.derived.nextOptimizationReason}`,
        ...(sample.integrity.warnings.length
            ? [
                '',
                '## Integrity warnings',
                '',
                ...sample.integrity.warnings.map((warning) => `- ${warning}`),
            ]
            : []),
        '',
        '## Stages',
        '',
        `- renderPromptMs: ${sample.stages.renderPromptMs}`,
        `- tokenizePromptMs: ${sample.stages.tokenizePromptMs}`,
        `- fetchContextMs: ${sample.stages.fetchContextMs}`,
        `- toolLoopMs: ${sample.stages.toolLoopMs}`,
        `- tokenizeOutputMs: ${sample.stages.tokenizeOutputMs}`,
        `- syncOutputContextMs: ${sample.stages.syncOutputContextMs}`,
        `- streamEmitMs: ${sample.stages.streamEmitMs}`,
        `- totalMs: ${sample.stages.totalMs}`,
        '',
        '## Loop',
        '',
        `- iterations: ${sample.loop.iterations}`,
        `- completionCalls: ${sample.loop.completionCalls}`,
        `- completionMs: ${sample.loop.completionMs}`,
        `- toolCalls: ${sample.loop.toolCalls}`,
        `- toolMs: ${sample.loop.toolMs}`,
    ].join('\n')
}

function pickNextOptimizationTarget(stages: ModelOverheadStages, loop: ModelLoopBreakdown) {
    const candidates: Array<{ key: keyof ModelOverheadStages | 'toolMs' | 'completionMs', ms: number, reason: string }> = [
        {
            key: 'completionMs',
            ms: loop.completionMs,
            reason: 'Model completion time is the largest measured slice. Reduce completion calls, shrink completion prompts, or improve decode throughput first.',
        },
        {
            key: 'toolMs',
            ms: loop.toolMs,
            reason: 'Tool execution time dominates. Improve tool planning, bundle operations, or avoid redundant verification passes first.',
        },
        {
            key: 'renderPromptMs',
            ms: stages.renderPromptMs,
            reason: 'Prompt rendering is unusually expensive. Cache or trim repeated prompt assembly work first.',
        },
        {
            key: 'tokenizePromptMs',
            ms: stages.tokenizePromptMs,
            reason: 'Prompt token counting is expensive. Cache token counts or avoid repeated tokenize calls first.',
        },
        {
            key: 'streamEmitMs',
            ms: stages.streamEmitMs,
            reason: 'Streaming the final answer is taking too long. Reduce artificial chunk delays or emit larger chunks first.',
        },
    ]
    candidates.sort((left, right) => right.ms - left.ms)
    return candidates[0]
}

function finalizeTokenCount({
    measured,
    timing,
    label,
    warnings,
}: {
    measured: number
    timing: number
    label: 'Prompt' | 'Generated'
    warnings: string[]
}) {
    if (measured > 0) {
        return {
            value: measured,
            source: 'tokenize' as const,
        }
    }

    if (timing > 0) {
        warnings.push(`${label} token count fell back to llama timings because tokenize returned ${measured}.`)
        return {
            value: timing,
            source: 'llama_timing_fallback' as const,
        }
    }

    warnings.push(`${label} token count is missing in this sample.`)
    return {
        value: 0,
        source: 'missing' as const,
    }
}

export async function writeModelOverheadSample(sample: Omit<ModelOverheadSample, 'derived' | 'integrity' | 'sampleId'> & {
    sampleId?: string
}) {
    const nextTarget = pickNextOptimizationTarget(sample.stages, sample.loop)
    const warnings: string[] = []
    const finalizedPrompt = finalizeTokenCount({
        measured: sample.promptTokens,
        timing: sample.llama.prompt_n,
        label: 'Prompt',
        warnings,
    })
    const finalizedGenerated = finalizeTokenCount({
        measured: sample.generatedTokens,
        timing: sample.llama.predicted_n,
        label: 'Generated',
        warnings,
    })
    const finalized: ModelOverheadSample = {
        ...sample,
        sampleId: sample.sampleId || `${sample.conversationId}:${sample.recordedAt}`,
        promptTokens: finalizedPrompt.value,
        generatedTokens: finalizedGenerated.value,
        integrity: {
            promptTokensSource: finalizedPrompt.source,
            generatedTokensSource: finalizedGenerated.source,
            warnings,
        },
        derived: {
            nonCompletionMs: Math.max(0, sample.stages.totalMs - sample.loop.completionMs),
            nonCompletionShare: sample.stages.totalMs > 0
                ? Number(((Math.max(0, sample.stages.totalMs - sample.loop.completionMs) / sample.stages.totalMs) * 100).toFixed(2))
                : 0,
            nextOptimizationTarget: nextTarget.key,
            nextOptimizationReason: nextTarget.reason,
        },
    }

    const root = getModelOverheadRoot()
    const stamp = finalized.recordedAt.replace(/[:.]/g, '-')
    const archiveJsonPath = path.join(root, `sample-${stamp}.json`)
    const latestJsonPath = path.join(root, 'latest.json')
    const latestMarkdownPath = path.join(root, 'latest.md')

    await mkdir(root, { recursive: true })
    await writeFile(latestJsonPath, `${JSON.stringify(finalized, null, 2)}\n`, 'utf8')
    await writeFile(archiveJsonPath, `${JSON.stringify(finalized, null, 2)}\n`, 'utf8')
    await writeFile(latestMarkdownPath, `${renderMarkdown(finalized)}\n`, 'utf8')

    return {
        sample: finalized,
        latestJsonPath,
        archiveJsonPath,
        latestMarkdownPath,
    }
}
