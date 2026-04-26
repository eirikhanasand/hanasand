import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chmod } from 'node:fs/promises'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAiUser } from './shared.ts'
import { buildTokenHint, getRepoCredential, touchRepoCredentialUsage, toRepoCredentialSummary } from '#utils/ai/repoCredentials.ts'
import { detectRepositoryStack } from '#utils/ai/stack.ts'

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

function runGit(args: string[], cwd?: string, env?: NodeJS.ProcessEnv) {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        const child = spawn('git', args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env,
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

async function createGitAskPass(tempDir: string) {
    const scriptPath = path.join(tempDir, 'git-askpass.sh')
    const script = `#!/bin/sh
case "$1" in
  *Username*) printf '%s' "x-access-token" ;;
  *Password*) printf '%s' "$HANASAND_GITHUB_TOKEN" ;;
  *) printf '%s' "" ;;
esac
`
    await writeFile(scriptPath, script, 'utf8')
    await chmod(scriptPath, 0o700)
    return scriptPath
}

function buildGitEnv(token: string | undefined, askPassPath?: string) {
    if (!token || !askPassPath) {
        return process.env
    }

    return {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: askPassPath,
        HANASAND_GITHUB_TOKEN: token,
    }
}

async function resolveDefaultBranch(repositoryUrl: string, gitEnv?: NodeJS.ProcessEnv) {
    const { stdout } = await runGit(['ls-remote', '--symref', repositoryUrl, 'HEAD'], undefined, gitEnv)
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

    const { input, existingId, githubToken } = req.body as { input?: string, existingId?: string, githubToken?: string } ?? {}
    if (!input?.trim()) {
        return res.status(400).send({ error: 'Missing repository input.' })
    }

    const parsed = parseGitHubInput(input)
    const repositoryUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`
    const savedCredential = existingId ? await getRepoCredential(existingId, userId).catch(() => null) : null
    const token = githubToken?.trim() || savedCredential?.token || ''
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-import-'))
    const askPassPath = token ? await createGitAskPass(tempDir) : undefined
    const gitEnv = buildGitEnv(token || undefined, askPassPath)
    const defaultBranch = await resolveDefaultBranch(repositoryUrl, gitEnv)
    const branch = parsed.branch || defaultBranch
    const cloneDir = path.join(tempDir, parsed.repo)

    try {
        await runGit(['clone', '--depth', '1', '--branch', branch, repositoryUrl, cloneDir], undefined, gitEnv)
        const pathspec = parsed.sourcePath || '.'
        const { stdout } = await runGit(['-C', cloneDir, 'ls-files', '--', pathspec], undefined, gitEnv)
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

        const { stackType, reason: stackReason } = detectRepositoryStack(files)
        const stackSupported = stackType !== 'unknown'
        const usedToken = Boolean(token)
        if (usedToken && existingId && savedCredential) {
            await touchRepoCredentialUsage(existingId, userId, true).catch(() => undefined)
        }
        const sourceUrl = parsed.sourcePath
            ? `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}/${parsed.sourcePath}`
            : `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}`

        return res.send({
            id: existingId || crypto.randomUUID(),
            ownerId: userId,
            accessScope: 'owned',
            name: parsed.repo,
            fullName: `${parsed.owner}/${parsed.repo}`,
            branch,
            defaultBranch,
            sourcePath: parsed.sourcePath,
            sourceUrl,
            authMode: usedToken ? 'github_token' : 'public',
            authHint: savedCredential?.summary?.hasCredential
                ? `Private GitHub access is stored server-side ${savedCredential.summary.tokenHint || ''}.`
                : usedToken
                    ? 'Private GitHub access succeeded. Save the token to the repository if you want future refreshes without re-entering it.'
                    : null,
            syncStatus: 'syncing',
            lastSyncedAt: null,
            lastSyncError: null,
            syncHistory: [{
                timestamp: new Date().toISOString(),
                status: 'syncing',
                source: existingId ? 'refresh' : 'import',
                message: existingId
                    ? `Repository content fetched${usedToken ? ' with one-time token auth' : ''}. Syncing into the editor workspace...`
                    : `Repository fetched${usedToken ? ' with one-time token auth' : ''}. Preparing the editor workspace...`,
            }],
            stackType,
            stackReason,
            stackSupported,
            credential: savedCredential?.summary || toRepoCredentialSummary({
                github_token_encrypted: usedToken ? 'attached' : null,
                github_token_hint: usedToken ? buildTokenHint(token) : null,
                github_token_attached_at: savedCredential?.summary.attachedAt || null,
                github_token_last_used_at: usedToken ? new Date().toISOString() : savedCredential?.summary.lastUsedAt || null,
                github_token_last_validated_at: usedToken ? new Date().toISOString() : savedCredential?.summary.lastValidatedAt || null,
            }),
            files,
            truncated: filePaths.length >= MAX_FILES,
            importedAt: new Date().toISOString(),
        } satisfies AIImportedRepo)
    } catch (error) {
        return res.status(502).send({
            error: error instanceof Error
                ? error.message.includes('Authentication failed') || error.message.includes('could not read Username')
                    ? 'GitHub authentication failed. Check the repository visibility or attach a valid repo-scoped token.'
                    : error.message
                : 'Failed to import repository.',
        })
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
