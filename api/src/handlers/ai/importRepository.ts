import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAiUser } from './shared.ts'

const MAX_FILES = 160
const MAX_FILE_SIZE = 250_000

type ParsedGitHubRepo = {
    owner: string
    repo: string
    branch?: string
    sourcePath: string
}

function parseGitHubInput(input: string): ParsedGitHubRepo {
    const trimmed = input.trim()
    const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/tree\/([^/?#]+)(?:\/(.*))?)?/i)
    if (urlMatch) {
        return {
            owner: urlMatch[1],
            repo: urlMatch[2].replace(/\.git$/i, ''),
            branch: urlMatch[3] || undefined,
            sourcePath: (urlMatch[4] || '').replace(/^\/+|\/+$/g, ''),
        }
    }

    const shortMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)(?:#([^\s:]+))?(?::(.+))?$/)
    if (!shortMatch) {
        throw new Error('Use a GitHub URL or owner/repo format.')
    }

    return {
        owner: shortMatch[1],
        repo: shortMatch[2].replace(/\.git$/i, ''),
        branch: shortMatch[3] || undefined,
        sourcePath: (shortMatch[4] || '').replace(/^\/+|\/+$/g, ''),
    }
}

function runGit(args: string[], cwd?: string) {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        const child = spawn('git', args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })

        child.on('error', (error) => reject(error))
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `git ${args.join(' ')} failed with code ${code}`))
                return
            }

            resolve({ stdout, stderr })
        })
    })
}

async function resolveDefaultBranch(repositoryUrl: string) {
    const { stdout } = await runGit(['ls-remote', '--symref', repositoryUrl, 'HEAD'])
    const match = stdout.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/)
    if (!match?.[1]) {
        throw new Error('Unable to determine the default branch for this repository.')
    }

    return match[1]
}

export default async function importRepository(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { input, existingId } = req.body as { input?: string, existingId?: string } ?? {}
    if (!input?.trim()) {
        return res.status(400).send({ error: 'Missing repository input.' })
    }

    const parsed = parseGitHubInput(input)
    const repositoryUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`
    const defaultBranch = await resolveDefaultBranch(repositoryUrl)
    const branch = parsed.branch || defaultBranch
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-import-'))
    const cloneDir = path.join(tempDir, parsed.repo)

    try {
        await runGit(['clone', '--depth', '1', '--branch', branch, repositoryUrl, cloneDir])
        const pathspec = parsed.sourcePath || '.'
        const { stdout } = await runGit(['-C', cloneDir, 'ls-files', '--', pathspec])
        const filePaths = stdout
            .split('\n')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .slice(0, MAX_FILES)

        const files: AIImportedRepoFile[] = []
        for (const filePath of filePaths) {
            const fullPath = path.join(cloneDir, filePath)
            const content = await readFile(fullPath, 'utf8').catch(() => null)
            if (content === null) {
                continue
            }
            if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
                continue
            }

            files.push({
                path: filePath,
                name: path.basename(filePath),
                content,
            })
        }

        const sourceUrl = parsed.sourcePath
            ? `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}/${parsed.sourcePath}`
            : `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}`

        return res.send({
            id: existingId || crypto.randomUUID(),
            name: parsed.repo,
            fullName: `${parsed.owner}/${parsed.repo}`,
            branch,
            defaultBranch,
            sourcePath: parsed.sourcePath,
            sourceUrl,
            syncStatus: 'syncing',
            lastSyncedAt: null,
            lastSyncError: null,
            syncHistory: [{
                timestamp: new Date().toISOString(),
                status: 'syncing',
                source: existingId ? 'refresh' : 'import',
                message: existingId ? 'Repository content fetched. Syncing into the editor workspace...' : 'Repository fetched. Preparing the editor workspace...',
            }],
            files,
            truncated: filePaths.length >= MAX_FILES,
            importedAt: new Date().toISOString(),
        } satisfies AIImportedRepo)
    } catch (error) {
        return res.status(502).send({
            error: error instanceof Error ? error.message : 'Failed to import repository.',
        })
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
