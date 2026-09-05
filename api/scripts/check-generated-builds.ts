import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Build each export with its own declared dependencies, as a user would.
const owned = !process.env.GENERATED_PROJECTS_DIR
const root = process.env.GENERATED_PROJECTS_DIR || await mkdtemp(path.join(tmpdir(), 'generated-builds-'))
process.env.GENERATED_PROJECTS_DIR = root
process.env.GENERATED_WEBSITE_DIR = path.join(root, 'website')
try {
    await import('./check-generated-projects.ts')
    await import('./check-generated-website.ts')
    for (const kind of ['api', 'worker', 'bot', 'website']) {
        for (const args of [['install', '--no-audit', '--no-fund'], ['run', 'build']]) {
            const result = spawnSync('npm', args, { cwd: path.join(root, kind), stdio: 'inherit' })
            if (result.error) throw result.error
            if (result.status !== 0) throw new Error(`Generated ${kind}: npm ${args.join(' ')} failed`)
        }
        console.log(`Generated ${kind}: dependency installation and build passed`)
    }
} finally { if (owned) await rm(root, { recursive: true, force: true }) }
