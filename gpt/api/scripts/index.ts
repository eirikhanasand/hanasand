import { spawn } from 'node:child_process'

type TestTask = {
    id: string
    title: string
    command: string[]
    requires?: 'model'
}

const bun = process.execPath

const tasks: TestTask[] = [
    scriptTask('orchestration-demo', 'Orchestration demo contract', 'orchestration-demo.ts'),
    scriptTask('orchestration-evaluate', 'Orchestration evaluation contract', 'orchestration-evaluate.ts'),
    scriptTask('orchestration-context-export', 'Orchestration context export contract', 'orchestration-context-export.ts'),
    {
        ...scriptTask('model-loopback', 'Model loopback smoke', 'model-loopback-smoke.mjs'),
        requires: 'model',
    },
    {
        ...scriptTask('mac-validation-profile', 'Mac validation profile smoke', 'mac-validation-profile-smoke.mjs'),
        requires: 'model',
    },
]

const selected = parseOnly()
const runnable = tasks.filter(task => selected.size ? selected.has(task.id) : shouldRunByDefault(task))

if (!runnable.length) {
    throw new Error(`No GPT API test tasks selected. Known tasks: ${tasks.map(task => task.id).join(', ')}`)
}

for (const task of runnable) {
    await runTask(task)
}

function scriptTask(id: string, title: string, scriptName: string): TestTask {
    return {
        id,
        title,
        command: [bun, `scripts/${scriptName}`],
    }
}

function shouldRunByDefault(task: TestTask) {
    if (task.requires === 'model') return process.env.RUN_MODEL_TESTS === '1'
    return true
}

function parseOnly() {
    const ids = new Set<string>()
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--only=')) {
            for (const id of arg.slice('--only='.length).split(',')) {
                if (id.trim()) ids.add(id.trim())
            }
        }
    }
    return ids
}

function runTask(task: TestTask) {
    return new Promise<void>((resolve, reject) => {
        console.log(`\n[gpt-api:test] ${task.title}`)
        const [command, ...args] = task.command
        const child = spawn(command, args, {
            cwd: process.cwd(),
            env: process.env,
            stdio: 'inherit',
        })

        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`${task.id} failed with exit code ${code}`))
        })
    })
}
