import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { collectSources, inventory, isInventoryPath, sha256 } from './code-inventory.mjs'

const run = promisify(execFile)
const [repository, output] = process.argv.slice(2)
if (!repository || !output) throw new Error('Usage: code-inventory-watch.mjs <bare repository> <published directory>')
await fs.mkdir(output, { recursive: true, mode: 0o750 })
const git = (...args) => run('git', ['--git-dir=' + repository, ...args], { timeout: 30000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10' } })
async function write(name, value) {
    const temporary = path.join(output, name + '.tmp')
    await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o640 })
    await fs.rename(temporary, path.join(output, name))
}
const analyzerHash = sha256(await fs.readFile(new URL('./code-inventory.mjs', import.meta.url)))
let current = ''
let previousInventory
let commitsRevision = ''
try { const previous = JSON.parse(await fs.readFile(path.join(output, 'current.json'), 'utf8')); current = previous.analyzerHash === analyzerHash ? previous.revision || '' : '' } catch { /* The first scan creates the inventory. */ }
try { previousInventory = JSON.parse(await fs.readFile(path.join(output, 'current.json'), 'utf8')) } catch { /* The first scan creates the inventory. */ }
try { commitsRevision = JSON.parse(await fs.readFile(path.join(output, 'commits.json'), 'utf8')).revision || '' } catch { /* The first scan creates the commit list. */ }
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
    if (revision !== commitsRevision) {
        const range = commitsRevision && await isAncestor(commitsRevision, revision) ? `${commitsRevision}..${revision}` : revision
        const fields = (await git('log', '-z', '--format=%H%x00%an%x00%cI%x00%s', range)).stdout.split('\0')
        const commits = []
        for (let index = 0; index + 3 < fields.length; index += 4) {
            commits.push({ external_id: fields[index], author: fields[index + 1], updated_at: fields[index + 2], title: fields[index + 3] })
        }
        const repositories = []
        for (const remote of ['origin', 'github']) {
            const raw = (await git('remote', 'get-url', remote)).stdout.trim().replace(/^git@([^:]+):/, 'https://$1/')
            const url = new URL(raw)
            repositories.push(`https://${url.hostname}${url.pathname.replace(/\.git$/, '').replace(/\/$/, '')}`)
        }
        const previousCommits = commitsRevision && await isAncestor(commitsRevision, revision) ? await readCommits() : []
        await write('commits.json', { revision, repositories, commits: [...commits, ...previousCommits] })
        commitsRevision = revision
    }
    if (revision !== current) {
        await write('status.json', { phase: 'indexing', revision, checkedAt: new Date().toISOString(), warning })
        const start = Date.now()
        const data = await updateInventory(revision)
        await write('current.json', { ...data, revision, analyzerHash, updatedAt: new Date().toISOString() })
        console.log(`Indexed ${revision}: ${data.nodes.length} items in ${Date.now() - start}ms`)
        current = revision
        previousInventory = { ...data, revision, analyzerHash }
    }
    await write('status.json', { phase: 'ready', revision: current, checkedAt: new Date().toISOString(), warning })
}

async function isAncestor(older, newer) {
    try { await git('merge-base', '--is-ancestor', older, newer); return true } catch { return false }
}

async function readCommits() {
    try { return JSON.parse(await fs.readFile(path.join(output, 'commits.json'), 'utf8')).commits || [] } catch { return [] }
}

async function changedPaths(older, newer) {
    const fields = (await git('diff', '--name-status', '-z', older, newer)).stdout.split('\0')
    const paths = []
    for (let index = 0; index < fields.length;) {
        const status = fields[index++]
        if (!status) continue
        const first = fields[index++]
        if (!first) continue
        paths.push(first)
        if (status[0] === 'R' || status[0] === 'C') paths.push(fields[index++])
    }
    return paths
}

async function readRevisionFile(revision, file) {
    try {
        const result = await git('show', `${revision}:${file}`)
        return result.stdout.includes('\0') ? null : result.stdout
    } catch { return null }
}

async function updateInventory(revision) {
    if (!previousInventory?.nodes?.length || !current || !(await isAncestor(current, revision))) {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'code-review-source-'))
        try {
            const archive = path.join(directory, 'source.tar'), source = path.join(directory, 'source')
            await fs.mkdir(source)
            await git('archive', '--format=tar', '--output=' + archive, revision)
            await run('tar', ['-xf', archive, '-C', source], { timeout: 30000 })
            return inventory(collectSources(source))
        } finally { await fs.rm(directory, { recursive: true, force: true }) }
    }

    const files = new Map(previousInventory.nodes.filter(item => item.kind === 'source' && typeof item.file === 'string' && typeof item.content === 'string').map(item => [item.file, item.content]))
    const paths = await changedPaths(current, revision)
    let changed = 0
    for (const file of paths) {
        if (!isInventoryPath(file)) continue
        const content = await readRevisionFile(revision, file)
        if (content === null) files.delete(file)
        else files.set(file, content)
        changed++
    }
    console.log(`Updating ${changed} changed source files from ${current}..${revision}`)
    return inventory(files)
}

while (true) {
    try { await scan() }
    catch (error) { await write('status.json', { phase: 'error', revision: current, checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'Git synchronization failed.' }); console.error('Git synchronization failed; retrying.') }
    await new Promise(resolve => setTimeout(resolve, 3000))
}
