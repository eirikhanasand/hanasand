import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { chmod } from 'node:fs/promises'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAiUser } from './shared.ts'
import { buildTokenHint, getRepoCredential, touchRepoCredentialUsage, toRepoCredentialSummary } from '#utils/ai/repoCredentials.ts'
import { detectRepositoryStack } from '#utils/ai/stack.ts'

const MAX_FILES = 10_000
const MAX_FILE_SIZE = 250_000

type ParsedGitRepo = {
    host: string
    owner: string
    repo: string
    fullName: string
    repositoryUrl: string
    branch?: string
    sourcePath: string
    webBaseUrl?: string
    isGitHub: boolean
}

export function parseGitInput(input: string): ParsedGitRepo {
    const trimmed = input.trim()
    const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/tree\/([^/?#]+)(?:\/(.*))?)?/i)
    if (urlMatch) {
        const repo = urlMatch[2].replace(/\.git$/i, '')
        return {
            host: 'github.com',
            owner: urlMatch[1],
            repo,
            fullName: `${urlMatch[1]}/${repo}`,
            repositoryUrl: `https://github.com/${urlMatch[1]}/${repo}.git`,
            branch: urlMatch[3] || undefined,
            sourcePath: (urlMatch[4] || '').replace(/^\/+|\/+$/g, ''),
            webBaseUrl: `https://github.com/${urlMatch[1]}/${repo}`,
            isGitHub: true,
        }
    }

    const genericUrl = parseGenericGitUrl(trimmed)
    if (genericUrl) {
        return genericUrl
    }

    const hostPathMatch = trimmed.match(/^([^/\s]+\.[^/\s]+)\/(.+?)(?:#([^\s:]+))?(?::(.+))?$/)
    if (hostPathMatch) {
        const parsed = buildGenericGitRepo({
            host: hostPathMatch[1],
            repoPath: hostPathMatch[2],
            repositoryUrl: `https://${hostPathMatch[1]}/${hostPathMatch[2]}`,
            branch: hostPathMatch[3],
            sourcePath: hostPathMatch[4] || '',
            webBaseUrl: `https://${hostPathMatch[1]}/${hostPathMatch[2].replace(/\.git$/i, '')}`,
        })
        if (parsed) {
            return parsed
        }
    }

    const shortMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)(?:#([^\s:]+))?(?::(.+))?$/)
    if (!shortMatch) {
        throw new Error('Use a Git URL, GitHub URL, or owner/repo format.')
    }

    const repo = shortMatch[2].replace(/\.git$/i, '')
    return {
        host: 'github.com',
        owner: shortMatch[1],
        repo,
        fullName: `${shortMatch[1]}/${repo}`,
        repositoryUrl: `https://github.com/${shortMatch[1]}/${repo}.git`,
        branch: shortMatch[3] || undefined,
        sourcePath: (shortMatch[4] || '').replace(/^\/+|\/+$/g, ''),
        webBaseUrl: `https://github.com/${shortMatch[1]}/${repo}`,
        isGitHub: true,
    }
}

function parseGenericGitUrl(input: string): ParsedGitRepo | null {
    const scpLikeMatch = input.match(/^git@([^:]+):(.+?)(?:#([^\s:]+))?(?::(.+))?$/i)
    if (scpLikeMatch) {
        const repoPath = scpLikeMatch[2].replace(/^\/+|\/+$/g, '')
        return buildGenericGitRepo({
            host: scpLikeMatch[1],
            repoPath,
            repositoryUrl: `https://${scpLikeMatch[1]}/${repoPath}`,
            branch: scpLikeMatch[3],
            sourcePath: scpLikeMatch[4] || '',
            webBaseUrl: `https://${scpLikeMatch[1]}/${repoPath.replace(/\.git$/i, '')}`,
        })
    }

    const sshSlashMatch = input.match(/^git@([^/\s]+)\/(.+?)(?:#([^\s:]+))?(?::(.+))?$/i)
    if (sshSlashMatch) {
        const repoPath = sshSlashMatch[2].replace(/^\/+|\/+$/g, '')
        return buildGenericGitRepo({
            host: sshSlashMatch[1],
            repoPath,
            repositoryUrl: `https://${sshSlashMatch[1]}/${repoPath}`,
            branch: sshSlashMatch[3],
            sourcePath: sshSlashMatch[4] || '',
            webBaseUrl: `https://${sshSlashMatch[1]}/${repoPath.replace(/\.git$/i, '')}`,
        })
    }

    let url: URL
    try {
        url = new URL(input)
    } catch {
        return null
    }

    if (!['http:', 'https:', 'git:', 'ssh:', 'git+ssh:'].includes(url.protocol)) {
        return null
    }

    const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    const treeIndex = pathParts.findIndex((part) => ['tree', 'src', 'branch'].includes(part.toLowerCase()))
    const repoParts = treeIndex >= 0 ? pathParts.slice(0, treeIndex) : pathParts
    const hashTarget = url.hash ? url.hash.slice(1) : ''
    const [hashBranch, ...hashSourceParts] = hashTarget.split(':')
    const branch = treeIndex >= 0 ? pathParts[treeIndex + 1] : hashBranch || undefined
    const sourcePath = treeIndex >= 0 ? pathParts.slice(treeIndex + 2).join('/') : hashSourceParts.join(':')
    if (!repoParts.length) {
        return null
    }

    return buildGenericGitRepo({
        host: url.host,
        repoPath: repoParts.join('/'),
        repositoryUrl: buildCloneUrl(url, repoParts),
        branch,
        sourcePath,
        webBaseUrl: `${url.protocol}//${url.host}/${repoParts.join('/').replace(/\.git$/i, '')}`,
    })
}

function buildGenericGitRepo({
    host,
    repoPath,
    repositoryUrl,
    branch,
    sourcePath = '',
    webBaseUrl,
}: {
    host: string
    repoPath: string
    repositoryUrl: string
    branch?: string
    sourcePath?: string
    webBaseUrl?: string
}): ParsedGitRepo | null {
    const parts = repoPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    if (!parts.length) {
        return null
    }

    const repo = parts.at(-1)!.replace(/\.git$/i, '')
    const owner = parts.length > 1 ? parts.at(-2)! : host
    const cleanRepoPath = [...parts.slice(0, -1), repo].join('/')
    const normalizedHost = host.toLowerCase()

    return {
        host: normalizedHost,
        owner,
        repo,
        fullName: normalizedHost === 'github.com' && parts.length >= 2 ? `${owner}/${repo}` : `${normalizedHost}/${cleanRepoPath}`,
        repositoryUrl: normalizedHost === 'github.com'
            ? `https://github.com/${cleanRepoPath}.git`
            : repositoryUrl.endsWith('.git')
                ? repositoryUrl
                : `${repositoryUrl}.git`,
        branch,
        sourcePath: sourcePath.replace(/^\/+|\/+$/g, ''),
        webBaseUrl,
        isGitHub: normalizedHost === 'github.com',
    }
}

function buildCloneUrl(url: URL, repoParts: string[]) {
    const cleanPath = repoParts.join('/')
    if ((url.protocol === 'ssh:' || url.protocol === 'git+ssh:') && url.username === 'git') {
        return `https://${url.host}/${cleanPath}${cleanPath.endsWith('.git') ? '' : '.git'}`
    }

    if ((url.protocol === 'ssh:' || url.protocol === 'git+ssh:') && url.username) {
        return `${url.username}@${url.host}:${cleanPath}${cleanPath.endsWith('.git') ? '' : '.git'}`
    }

    return `${url.protocol}//${url.host}/${cleanPath}${cleanPath.endsWith('.git') ? '' : '.git'}`
}

function runGit(args: string[], cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs = 120_000) {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        const child = spawn('git', args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env,
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
        return {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
        }
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

export function describeImportError(error: unknown) {
    if (!(error instanceof Error)) {
        return { status: 502, message: 'Failed to import repository.' }
    }

    const message = error.message
    if (message.includes('Use a Git URL')) {
        return { status: 400, message }
    }

    if (
        message.includes('The requested URL returned error: 502')
        || message.includes('The requested URL returned error: 503')
        || message.includes('The requested URL returned error: 504')
        || message.includes('Could not resolve host')
        || message.includes('Failed to connect')
        || message.includes('Connection refused')
    ) {
        return { status: 503, message: 'Git server unavailable. Try again when the remote is reachable.' }
    }

    if (message.includes('Authentication failed') || message.includes('could not read Username') || message.includes('Could not read from remote repository')) {
        return { status: 401, message: 'Git authentication failed. Check the repository visibility or attach a valid token.' }
    }

    if (message.includes('Repository not found') || message.includes('not found')) {
        return { status: 404, message: 'Repository not found. Check the URL and repository visibility.' }
    }

    return { status: 502, message }
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

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hanasand-import-'))

    try {
        const parsed = parseGitInput(input)
        const repositoryUrl = parsed.repositoryUrl
        const savedCredential = existingId ? await getRepoCredential(existingId, userId).catch(() => null) : null
        const token = parsed.isGitHub ? githubToken?.trim() || savedCredential?.token || '' : ''
        const askPassPath = token ? await createGitAskPass(tempDir) : undefined
        const gitEnv = buildGitEnv(token || undefined, askPassPath)
        const defaultBranch = await resolveDefaultBranch(repositoryUrl, gitEnv)
        const branch = parsed.branch || defaultBranch
        const cloneDir = path.join(tempDir, parsed.repo)

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
        const sourceUrl = parsed.webBaseUrl
            ? parsed.sourcePath
                ? `${parsed.webBaseUrl}/tree/${branch}/${parsed.sourcePath}`
                : `${parsed.webBaseUrl}/tree/${branch}`
            : repositoryUrl

        return res.send({
            id: existingId || crypto.randomUUID(),
            ownerId: userId,
            accessScope: 'owned',
            name: parsed.repo,
            fullName: parsed.fullName,
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
        const { status, message } = describeImportError(error)
        return res.status(status).send({ error: message })
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
    }
}
