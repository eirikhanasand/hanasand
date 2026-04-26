import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const API_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function getModelOverheadRoot() {
    return path.join(API_ROOT, 'runtime', 'model-overhead')
}

function renderMarkdown(sample) {
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

function pickNextOptimizationTarget(stages, loop) {
    const candidates = [
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

function finalizeTokenCount({ measured, timing, label, warnings }) {
    if (measured > 0) {
        return {
            value: measured,
            source: 'tokenize',
        }
    }

    if (timing > 0) {
        warnings.push(`${label} token count fell back to llama timings because tokenize returned ${measured}.`)
        return {
            value: timing,
            source: 'llama_timing_fallback',
        }
    }

    warnings.push(`${label} token count is missing in this sample.`)
    return {
        value: 0,
        source: 'missing',
    }
}

export async function writeModelOverheadSample(sample) {
    const nextTarget = pickNextOptimizationTarget(sample.stages, sample.loop)
    const warnings = []
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
    const finalized = {
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
