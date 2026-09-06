import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { collectSources, inventory, sha256 } from './code-inventory.mjs'

const run = promisify(execFile)
const [repository, output] = process.argv.slice(2)
if (!repository || !output) throw new Error('Usage: code-inventory-watch.mjs <bare repository> <published directory>')
await fs.mkdir(output, { recursive: true, mode: 0o750 })
const git = (...args) => run('git', ['--git-dir=' + repository, ...args], { timeout: 30000, maxBuffer: 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10' } })
async function write(name, value) {
    const temporary = path.join(output, name + '.tmp')
    await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o640 })
    await fs.rename(temporary, path.join(output, name))
}
const analyzerHash = sha256(await fs.readFile(new URL('./code-inventory.mjs', import.meta.url)))
let current = ''
try { const previous = JSON.parse(await fs.readFile(path.join(output, 'current.json'), 'utf8')); current = previous.analyzerHash === analyzerHash ? previous.revision || '' : '' } catch { /* The first scan creates the inventory. */ }
async function latest() {
    const revisions = [], failed = []
    for (const remote of ['origin', 'github']) {
        try {
            await git('fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, '+refs/heads/main:refs/remotes/' + remote + '/main')
            revisions.push((await git('rev-parse', 'refs/remotes/' + remote + '/main')).stdout.trim())
        } catch { failed.push(remote) }
    }
    if (!revisions.length) throw new Error('Neither Git remote could be reached. Retrying automatically.')
    let revision = revisions[0]
    for (const candidate of revisions.slice(1)) if (candidate !== revision) {
        try { await git('merge-base', '--is-ancestor', revision, candidate); revision = candidate }
        catch {
            try { await git('merge-base', '--is-ancestor', candidate, revision) }
            catch { throw new Error('The Git mirrors have diverged. Resolve main before the inventory can advance.') }
        }
    }
    return { revision, warning: failed.length ? 'Could not check ' + failed.join(' and ') + '. Retrying automatically.' : undefined }
}
async function scan() {
    const { revision, warning } = await latest()
    if (revision !== current) {
        await write('status.json', { phase: 'indexing', revision, checkedAt: new Date().toISOString(), warning })
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'code-review-source-'))
        try {
            const archive = path.join(directory, 'source.tar'), source = path.join(directory, 'source')
            await fs.mkdir(source)
            await git('archive', '--format=tar', '--output=' + archive, revision)
            await run('tar', ['-xf', archive, '-C', source], { timeout: 30000 })
            const start = Date.now(), data = inventory(collectSources(source))
            await write('current.json', { ...data, revision, analyzerHash, updatedAt: new Date().toISOString() })
            console.log(`Indexed ${revision}: ${data.nodes.length} items in ${Date.now() - start}ms`)
            current = revision
        } finally { await fs.rm(directory, { recursive: true, force: true }) }
    }
    await write('status.json', { phase: 'ready', revision: current, checkedAt: new Date().toISOString(), warning })
}
while (true) {
    try { await scan() }
    catch (error) { await write('status.json', { phase: 'error', revision: current, checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'Git synchronization failed.' }); console.error('Git synchronization failed; retrying.') }
    await new Promise(resolve => setTimeout(resolve, 3000))
}
