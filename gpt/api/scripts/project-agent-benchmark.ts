import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import config from '#constants'
import runModelToolLoop from '#utils/tools/modelToolLoop.ts'

type BenchmarkArgs = {
    name: string
    endpoint: string
    targetDir: string
    timeoutMs: number
}

function argValue(name: string, fallback = '') {
    const prefix = `--${name}=`
    return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback
}

function slug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'model'
}

async function exists(filePath: string) {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}

async function run(command: string, cwd: string, timeoutMs: number) {
    const startedAt = Date.now()
    return await new Promise<{ exitCode: number | null, stdout: string, stderr: string, timedOut: boolean, ms: number }>((resolve) => {
        const child = spawn('/bin/sh', ['-lc', command], {
            cwd,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        let timedOut = false
        const timer = setTimeout(() => {
            timedOut = true
            child.kill('SIGTERM')
        }, timeoutMs)

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('close', (exitCode) => {
            clearTimeout(timer)
            resolve({
                exitCode,
                stdout: stdout.slice(-12000),
                stderr: stderr.slice(-12000),
                timedOut,
                ms: Date.now() - startedAt,
            })
        })
        child.on('error', (error) => {
            clearTimeout(timer)
            resolve({
                exitCode: 1,
                stdout,
                stderr: String(error),
                timedOut,
                ms: Date.now() - startedAt,
            })
        })
    })
}

async function evaluate(targetDir: string) {
    const absoluteTarget = path.resolve(config.repo_root, targetDir)
    const candidates = {
        packageJson: path.join(absoluteTarget, 'package.json'),
        dockerfile: path.join(absoluteTarget, 'Dockerfile'),
        compose: path.join(absoluteTarget, 'docker-compose.yml'),
        appPage: path.join(absoluteTarget, 'src/app/page.tsx'),
        legacyAppPage: path.join(absoluteTarget, 'app/page.tsx'),
    }
    const fileChecks = Object.fromEntries(await Promise.all(
        Object.entries(candidates).map(async ([key, filePath]) => [key, await exists(filePath)])
    ))

    const pagePath = await exists(candidates.appPage) ? candidates.appPage : candidates.legacyAppPage
    const pageContent = await fs.readFile(pagePath, 'utf8').catch(() => '')
    const requirementHits = [
        /Aurora/i,
        /Kanban|board/i,
        /pricing/i,
        /testimonials?/i,
        /analytics?|metric/i,
        /responsive|mobile/i,
    ].filter((pattern) => pattern.test(pageContent)).length

    const packageJson = await fs.readFile(candidates.packageJson, 'utf8').catch(() => '')
    const hasBuildScript = /"build"\s*:/.test(packageJson)
    const composeConfig = fileChecks.compose
        ? await run('docker compose config', absoluteTarget, 120000)
        : null
    const build = hasBuildScript
        ? await run('npm run build', absoluteTarget, 10 * 60 * 1000)
        : null

    const score =
        Number(fileChecks.packageJson) * 10
        + Number(fileChecks.dockerfile) * 10
        + Number(fileChecks.compose) * 10
        + Number(fileChecks.appPage || fileChecks.legacyAppPage) * 10
        + requirementHits * 6
        + (composeConfig?.exitCode === 0 ? 15 : 0)
        + (build?.exitCode === 0 ? 25 : 0)

    return {
        absoluteTarget,
        fileChecks,
        requirementHits,
        composeConfig,
        build,
        score,
    }
}

async function main() {
    const name = argValue('name', 'model')
    const endpoint = argValue('endpoint', process.env.MODEL_API || 'http://127.0.0.1:18081')
    const targetDir = argValue('target', `sandbox/model-bench-${slug(name)}-${Date.now()}`)
    const timeoutMs = Number(argValue('timeout-ms', String(20 * 60 * 1000)))
    const args: BenchmarkArgs = { name, endpoint, targetDir, timeoutMs }
    const startedAt = Date.now()

    await fs.rm(path.resolve(config.repo_root, targetDir), { recursive: true, force: true })

    const prompt = [
        `Build a complete Dockerized Next.js App Router project in ${targetDir}.`,
        'The product is "Aurora Sprint", a project planning dashboard for freelance web studios.',
        'It must be an actual polished app, not a placeholder: responsive dashboard layout, kanban board, pricing panel, testimonial strip, analytics/metrics cards, and a clear empty/loading state.',
        'Include a production Dockerfile, docker-compose.yml, package scripts, typed React components, and professional CSS/Tailwind styling.',
        'Verify it with npm run build and docker compose config. Fix any errors before answering.',
        'Use tools autonomously. Do not stop at a plan.',
    ].join(' ')

    const result = await Promise.race([
        runModelToolLoop({
            type: 'prompt_request',
            conversationId: `benchmark-${slug(name)}-${Date.now()}`,
            clientName: `benchmark:${name}`,
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 10000,
            temperature: 0.7,
        }, endpoint),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Benchmark timed out after ${timeoutMs}ms`)), timeoutMs)),
    ])

    const evaluation = await evaluate(targetDir)
    const report = {
        args,
        elapsedMs: Date.now() - startedAt,
        modelResult: {
            content: result.content.slice(0, 4000),
            overhead: result.overhead,
            artifactCount: result.artifacts?.length || 0,
        },
        evaluation,
    }

    const outputDir = path.resolve(config.gpt_dir, 'api/runtime/model-benchmarks')
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, `${Date.now()}-${slug(name)}.json`)
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8')
    console.log(JSON.stringify({ outputPath, score: evaluation.score, elapsedMs: report.elapsedMs }, null, 2))
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
