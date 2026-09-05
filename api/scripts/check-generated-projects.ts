import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { parse } from 'yaml'
import { buildShareProjectResponse } from '../src/handlers/tools/ai.ts'

type File = { action: string, path: string, content: string }
const root = await mkdtemp(path.join(tmpdir(), 'generated-projects-'))
const prompts = {
    api: 'Build a records API called "Record Desk" with validation, idempotency and pagination.',
    worker: 'Build a worker queue called "Job Desk" with retries and cancellation.',
    bot: 'Build a Discord bot called "Safe Bot" with restart requests.',
}
try {
    assert.equal(buildShareProjectResponse('Hello!'), null)
    for (const [kind, prompt] of Object.entries(prompts)) {
        const response = buildShareProjectResponse(prompt)!
        assert.equal(response.status, 'completed')
        const files = [...response.message.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].map(match => JSON.parse(match[1]) as File)
        const names = new Set(files.map(file => file.path))
        assert.equal(names.size, files.length, 'File paths must be unique')
        for (const name of ['package.json', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml', 'README.md', '.env.example', 'src/index.ts']) {
            assert.ok(names.has(name), `${kind}: missing ${name}`)
        }
        const directory = path.join(root, kind)
        for (const file of files) {
            assert.equal(file.action, 'upsert_share')
            assert.ok(!path.isAbsolute(file.path) && !file.path.split(/[\\/]/).includes('..'), 'Export paths must stay inside the project')
            assert.doesNotMatch(file.content, /sk-[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{20,}/, 'Generated files must not contain credentials')
            if (file.path.endsWith('.json')) JSON.parse(file.content)
            if (/\.ya?ml$/.test(file.path)) parse(file.content)
            if (/\.tsx?$/.test(file.path)) {
                const result = ts.transpileModule(file.content, { fileName: file.path, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext } })
                assert.deepEqual(result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error), [], `${kind}/${file.path} must parse`)
            }
            const target = path.join(directory, file.path)
            await mkdir(path.dirname(target), { recursive: true })
            await writeFile(target, file.content)
            if (process.env.GENERATED_PROJECTS_DIR) {
                const exported = path.join(process.env.GENERATED_PROJECTS_DIR, kind, file.path)
                await mkdir(path.dirname(exported), { recursive: true })
                await writeFile(exported, file.content)
            }
        }
        const readme = files.find(file => file.path === 'README.md')!.content
        assert.match(readme, /npm run build/)
        const pkg = JSON.parse(files.find(file => file.path === 'package.json')!.content)
        assert.ok(pkg.devDependencies['@types/node'], 'Node types must be declared, not supplied by an accidental transitive dependency')
        for (const script of ['dev', 'build', 'start']) assert.ok(pkg.scripts[script], `${kind}: missing ${script} command`)
        assert.equal(buildShareProjectResponse(prompt)!.message, response.message, 'Cache must preserve all exported files')
        await symlink(path.resolve('node_modules'), path.join(directory, 'node_modules'))
        if (kind === 'bot') {
            assert.match(readme, /stubs/)
            checkBot(directory)
            assert.doesNotMatch(files.find(file => file.path === '.env.example')!.content, /DISCORD_TOKEN=(?!replace_me).+/)
        }
        if (kind === 'worker') {
            assert.match(readme, /in memory/)
            const queue = await import(pathToFileURL(path.join(directory, 'src/queue.ts')).href)
            const job = queue.enqueue('render', { idempotencyKey: 'one' })
            assert.equal(queue.enqueue('render', { idempotencyKey: 'one' }).id, job.id)
            assert.equal(queue.jobs.length, 1)
            assert.equal(queue.nextJob().id, job.id)
            queue.cancelJob(job.id)
            assert.equal(queue.nextJob(), undefined, 'Cancelled jobs must not run')
            assert.equal(queue.cancelJob('missing'), null)
            assert.equal(queue.replayDeadLetter('missing'), null)
            const failed = queue.enqueue('retry')
            failed.status = 'failed'; failed.attempts = 1; failed.nextRunAt = Date.now() + 60000
            assert.equal(queue.nextJob(), undefined, 'Backoff must delay retries')
            failed.nextRunAt = 0
            assert.equal(queue.nextJob().id, failed.id)
            failed.attempts = 3
            assert.equal(queue.nextJob(), undefined, 'Exhausted retries must stop')
        }
        if (kind === 'api' || kind === 'worker') {
            const program = ts.createProgram(files.filter(file => /\.ts$/.test(file.path)).map(file => path.join(directory, file.path)), { noEmit: true, strict: true, skipLibCheck: true, esModuleInterop: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext })
            const errors = ts.getPreEmitDiagnostics(program).filter(item => item.category === ts.DiagnosticCategory.Error)
            assert.deepEqual(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), [], `${kind} must type-check`)
            await checkRuntime(directory, kind)
        }
        console.log(`Generated ${kind}: export, configuration and behavior passed`)
    }
} finally { await rm(root, { recursive: true, force: true }) }

async function checkRuntime(directory: string, kind: string) {
    const child = spawn(process.execPath, ['src/index.ts'], { cwd: directory, env: { PATH: process.env.PATH, PORT: '0', API_TOKEN: 'test-only-token', RATE_LIMIT_PER_MINUTE: '100' }, stdio: ['ignore', 'pipe', 'pipe'] })
    let logs = ''
    try {
        const base = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => { reject(new Error(`Generated ${kind} did not start: ${logs}`)) }, 10000)
            const collect = (chunk: Buffer) => {
                logs += chunk.toString()
                const address = logs.match(/Server listening at http:\/\/127\.0\.0\.1:(\d+)/)
                if (address) { clearTimeout(timeout); resolve(`http://127.0.0.1:${address[1]}`) }
            }
            child.stdout.on('data', collect)
            child.stderr.on('data', collect)
            child.once('error', error => { clearTimeout(timeout); reject(error) })
            child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Generated ${kind} exited ${code}: ${logs}`)) })
        })
        const request = async (route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => fetch(base + route, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(3000) })
        assert.equal((await request('/health')).status, 200)
        if (kind === 'worker') {
            assert.equal((await request('/api/worker-status')).status, 200)
            assert.equal((await request('/api/jobs', 'POST', {})).status, 400)
            const created = await request('/api/jobs', 'POST', { name: 'render' })
            assert.equal(created.status, 201)
            const job = await created.json()
            assert.equal((await request(`/api/jobs/${job.id}/cancel`, 'POST', {})).status, 200)
            assert.equal((await request('/api/jobs/missing/cancel', 'POST', {})).status, 404)
        } else {
            const auth = { authorization: 'Bearer test-only-token' }
            assert.equal((await request('/records', 'POST', { title: 'Denied' })).status, 403)
            assert.equal((await request('/records', 'POST', {}, auth)).status, 400)
            const created = await request('/records', 'POST', { title: 'First', idempotencyKey: 'one' }, auth)
            assert.equal(created.status, 201)
            const record = await created.json()
            const duplicate = await request('/records', 'POST', { title: 'First', idempotencyKey: 'one' }, auth)
            assert.equal((await duplicate.json()).id, record.id)
            assert.equal((await request('/records', 'POST', { title: 'Second' }, auth)).status, 201)
            const first = await (await request('/records?limit=1')).json()
            assert.equal(first.items.length, 1)
            assert.ok(first.nextCursor)
            const second = await (await request(`/records?limit=1&cursor=${first.nextCursor}`)).json()
            assert.equal(second.items.length, 1)
            assert.notEqual(first.items[0].id, second.items[0].id)
            assert.equal(second.nextCursor, null)
            assert.equal((await request(`/records/${record.id}`, 'DELETE')).status, 403)
        }
    } finally {
        if (child.exitCode === null && child.signalCode === null) {
            const stopped = new Promise(resolve => child.once('exit', resolve))
            child.kill('SIGKILL')
            await stopped
        }
    }
}

function checkBot(directory: string) {
    const result = spawnSync(process.execPath, ['--eval', `
        import assert from 'node:assert/strict'
        import { mock } from 'bun:test'
        const handlers = new Map()
        let token
        mock.module('discord.js', () => ({
            Client: class {
                once() {}
                on(event, handler) { handlers.set(event, handler) }
                async login(value) { token = value }
            },
            Events: { MessageCreate: 'message', ClientReady: 'ready' },
            GatewayIntentBits: { Guilds: 1, GuildMessages: 2, MessageContent: 4 },
        }))
        await import('./src/index.ts')
        assert.equal(token, 'test-only-token')
        const replies = []
        const message = { author: { id: 'user', bot: false }, content: '!restart now', reply: async text => replies.push(text) }
        await handlers.get('message')(message)
        assert.deepEqual(replies, ['Restart request logged for review. Nothing destructive was executed.'])
        await handlers.get('message')({ ...message, author: { id: 'bot', bot: true } })
        assert.equal(replies.length, 1, 'Bot messages must not trigger commands')
        await handlers.get('message')({ ...message, content: '!audit' })
        assert.equal(replies.at(-1), '!restart now')
    `], { cwd: directory, env: { PATH: process.env.PATH, DISCORD_TOKEN: 'test-only-token', DISCORD_CLIENT_ID: 'test-only-id' }, encoding: 'utf8', timeout: 10000 })
    if (result.error) throw result.error
    assert.equal(result.status, 0, result.stderr || 'Generated bot command handling failed')
}
