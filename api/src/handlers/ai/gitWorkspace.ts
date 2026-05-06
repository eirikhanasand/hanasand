import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getRepoCredential } from '#utils/ai/repoCredentials.ts'
import { parseGitInput } from './importRepository.ts'
import { requireAiUser } from './shared.ts'

type RepositoryRow = {
    id: string
    owner_id: string
    name: string
    full_name: string
    branch: string
    source_url: string
    source_path: string
}

type ShareFileRow = {
    id: string
    name: string
    type: string
    content: string | null
    file_path: string
}

const workspaceRoot = path.join(os.tmpdir(), 'hanasand-git-workspaces')

async function runGit(args: string[], cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs = 120_000) {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        const child = spawn('git', args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
                ...(env || {}),
            },
        })

        let stdout = ''
        let stderr = ''
        let settled = false
        const timeout = setTimeout(() => {
            if (settled) return
            settled = true
            child.kill('SIGTERM')
            reject(new Error(`git ${args.join(' ')} timed out. Check the repository URL or credentials.`))
        }, timeoutMs)

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('error', (error) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            reject(error)
        })
        child.on('close', (code) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            if (code !== 0) {
                reject(new Error(stderr.trim() || `git ${args.join(' ')} failed with code ${code}`))
                return
            }

            resolve({ stdout, stderr })
        })
    })
}

async function createGitAskPass(parentPath: string) {
    await mkdir(parentPath, { recursive: true })
    const askPassPath = path.join(parentPath, '.hanasand-git-askpass.sh')
    const script = `#!/bin/sh
case "$1" in
  *Username*) printf '%s' "x-access-token" ;;
  *Password*) printf '%s' "$HANASAND_GITHUB_TOKEN" ;;
  *) printf '%s' "" ;;
esac
`
    await writeFile(askPassPath, script, 'utf8')
    await chmod(askPassPath, 0o700)
    return askPassPath
}

async function getRepository(repositoryId: string, userId: string) {
    const result = await run(`
        SELECT id, owner_id, name, full_name, branch, source_url, source_path
        FROM ai_imported_repositories
        WHERE id = $1
          AND owner_id = $2
    `, [repositoryId, userId])

    return (result.rows as RepositoryRow[])[0] || null
}

async function getShareFiles(shareId: string, userId: string) {
    const result = await run(`
        WITH RECURSIVE tree AS (
            SELECT id, name, parent, type, content, ''::text AS file_path, owner
            FROM share
            WHERE id = $1
              AND owner = $2
            UNION ALL
            SELECT child.id,
                   child.name,
                   child.parent,
                   child.type,
                   child.content,
                   CASE
                       WHEN tree.file_path = '' THEN child.name
                       ELSE tree.file_path || '/' || child.name
                   END AS file_path,
                   child.owner
            FROM share AS child
            JOIN tree
              ON child.parent = tree.id
        )
        SELECT id, name, type, content, file_path
        FROM tree
        WHERE type = 'file'
          AND file_path <> ''
        ORDER BY file_path ASC
    `, [shareId, userId])

    return result.rows as ShareFileRow[]
}

function workspacePathFor(userId: string, repositoryId: string) {
    return path.join(workspaceRoot, userId.replace(/[^a-zA-Z0-9_-]/g, '_'), repositoryId.replace(/[^a-zA-Z0-9_-]/g, '_'))
}

async function pathExists(filePath: string) {
    return stat(filePath).then(() => true).catch(() => false)
}

async function prepareWorkspace(repository: RepositoryRow, userId: string) {
    const parsed = parseGitInput(repository.source_url || repository.full_name)
    const workspacePath = workspacePathFor(userId, repository.id)
    const parentPath = path.dirname(workspacePath)
    await mkdir(parentPath, { recursive: true })

    const credential = parsed.isGitHub ? await getRepoCredential(repository.id, userId).catch(() => null) : null
    const askPassPath = credential?.token ? await createGitAskPass(parentPath) : null
    const gitEnv = askPassPath && credential?.token ? { GIT_ASKPASS: askPassPath, HANASAND_GITHUB_TOKEN: credential.token } : undefined

    if (!await pathExists(path.join(workspacePath, '.git'))) {
        await rm(workspacePath, { recursive: true, force: true })
        await runGit(['clone', parsed.repositoryUrl, workspacePath], undefined, gitEnv)
    }

    await runGit(['-C', workspacePath, 'remote', 'set-url', 'origin', parsed.repositoryUrl], undefined, gitEnv)
    await runGit(['-C', workspacePath, 'config', 'user.name', 'Hanasand'], undefined, gitEnv)
    await runGit(['-C', workspacePath, 'config', 'user.email', 'git@hanasand.com'], undefined, gitEnv)
    await runGit(['-C', workspacePath, 'checkout', repository.branch], undefined, gitEnv)
        .catch(() => runGit(['-C', workspacePath, 'checkout', '-b', repository.branch, `origin/${repository.branch}`], undefined, gitEnv))

    return { workspacePath, gitEnv }
}

function assertSafeRelativePath(filePath: string) {
    if (!filePath || path.isAbsolute(filePath) || filePath.split('/').includes('..')) {
        throw new Error(`Unsafe file path: ${filePath}`)
    }
}

async function overlayShareFiles(workspacePath: string, files: ShareFileRow[]) {
    for (const file of files) {
        assertSafeRelativePath(file.file_path)
        const fullPath = path.join(workspacePath, file.file_path)
        await mkdir(path.dirname(fullPath), { recursive: true })
        await writeFile(fullPath, file.content || '', 'utf8')
    }
}

async function loadWorkspace(repositoryId: string, shareId: string, userId: string) {
    const repository = await getRepository(repositoryId, userId)
    if (!repository) {
        throw new Error('Repository not found.')
    }

    const files = await getShareFiles(shareId, userId)
    const { workspacePath, gitEnv } = await prepareWorkspace(repository, userId)
    await overlayShareFiles(workspacePath, files)
    return { repository, files, workspacePath, gitEnv }
}

function parsePorcelain(stdout: string): AIGitStatusFile[] {
    return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            const rawPath = line.slice(3)
            const renamePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath
            return {
                path: renamePath.trim(),
                index: line[0] || ' ',
                workingTree: line[1] || ' ',
                selected: false,
            }
        })
}

async function buildStatus(workspacePath: string, gitEnv?: NodeJS.ProcessEnv) {
    const [{ stdout: statusOut }, { stdout: branchOut }] = await Promise.all([
        runGit(['-C', workspacePath, 'status', '--porcelain'], undefined, gitEnv),
        runGit(['-C', workspacePath, 'status', '--short', '--branch'], undefined, gitEnv),
    ])

    return {
        files: parsePorcelain(statusOut),
        branchSummary: branchOut.split('\n')[0]?.replace(/^##\s*/, '') || null,
    }
}

async function requireUser(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }

    return userId
}

export async function getGitWorkspaceStatus(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const { shareId } = req.query as { shareId?: string }
    if (!id || !shareId) {
        return res.status(400).send({ error: 'Missing repository or share id.' })
    }

    try {
        const { workspacePath, gitEnv } = await loadWorkspace(id, shareId, userId)
        return res.send(await buildStatus(workspacePath, gitEnv))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Failed to load Git status.' })
    }
}

export async function postGitWorkspacePull(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const repository = await getRepository(id, userId)
    if (!repository) {
        return res.status(404).send({ error: 'Repository not found.' })
    }

    try {
        const { workspacePath, gitEnv } = await prepareWorkspace(repository, userId)
        await runGit(['-C', workspacePath, 'pull', '--rebase', 'origin', repository.branch], undefined, gitEnv)
        return res.send(await buildStatus(workspacePath, gitEnv))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Failed to pull repository.' })
    }
}

export async function postGitWorkspaceCommit(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const { shareId, message, paths } = req.body as { shareId?: string, message?: string, paths?: string[] } ?? {}
    const commitMessage = typeof message === 'string' ? message.trim() : ''
    const selectedPaths = Array.isArray(paths) ? paths.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim()) : []

    if (!id || !shareId) {
        return res.status(400).send({ error: 'Missing repository or share id.' })
    }
    if (!commitMessage) {
        return res.status(400).send({ error: 'Enter a commit message.' })
    }
    if (!selectedPaths.length) {
        return res.status(400).send({ error: 'Stage at least one file before committing.' })
    }

    try {
        selectedPaths.forEach(assertSafeRelativePath)
        const { workspacePath, gitEnv } = await loadWorkspace(id, shareId, userId)
        await runGit(['-C', workspacePath, 'add', '--', ...selectedPaths], undefined, gitEnv)
        await runGit(['-C', workspacePath, 'commit', '-m', commitMessage], undefined, gitEnv)
        const { stdout } = await runGit(['-C', workspacePath, 'rev-parse', '--short', 'HEAD'], undefined, gitEnv)
        return res.send({
            ok: true,
            commit: stdout.trim(),
            status: await buildStatus(workspacePath, gitEnv),
        })
    } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Failed to commit staged files.'
        return res.status(400).send({ error: messageText.includes('nothing to commit') ? 'Nothing changed in the staged files.' : messageText })
    }
}

export async function postGitWorkspacePush(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireUser(req, res)
    if (!userId) return

    const { id } = req.params as { id: string }
    const repository = await getRepository(id, userId)
    if (!repository) {
        return res.status(404).send({ error: 'Repository not found.' })
    }

    try {
        const { workspacePath, gitEnv } = await prepareWorkspace(repository, userId)
        await runGit(['-C', workspacePath, 'push', 'origin', `HEAD:${repository.branch}`], undefined, gitEnv)
        return res.send(await buildStatus(workspacePath, gitEnv))
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Failed to push repository.' })
    }
}
