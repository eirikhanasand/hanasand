import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { describeImportError, parseGitInput } from '../src/handlers/ai/importRepository.ts'

type GitInputCase = {
    input: string
    repositoryUrl: string
    fullName: string
    reachable?: boolean
}

const cases: GitInputCase[] = [
    {
        input: 'git@git.hanasand.com/eirikhanasand/hanasand',
        repositoryUrl: 'https://git.hanasand.com/eirikhanasand/hanasand.git',
        fullName: 'git.hanasand.com/eirikhanasand/hanasand',
        reachable: true,
    },
    {
        input: 'git@git.hanasand.com:eirikhanasand/hanasand',
        repositoryUrl: 'https://git.hanasand.com/eirikhanasand/hanasand.git',
        fullName: 'git.hanasand.com/eirikhanasand/hanasand',
        reachable: true,
    },
    {
        input: 'ssh://git@git.hanasand.com/eirikhanasand/hanasand',
        repositoryUrl: 'https://git.hanasand.com/eirikhanasand/hanasand.git',
        fullName: 'git.hanasand.com/eirikhanasand/hanasand',
        reachable: true,
    },
    {
        input: 'git+ssh://git@git.hanasand.com/eirikhanasand/hanasand',
        repositoryUrl: 'https://git.hanasand.com/eirikhanasand/hanasand.git',
        fullName: 'git.hanasand.com/eirikhanasand/hanasand',
        reachable: true,
    },
    {
        input: 'git@github.com:eirikhanasand/hanasand.git',
        repositoryUrl: 'https://github.com/eirikhanasand/hanasand.git',
        fullName: 'eirikhanasand/hanasand',
        reachable: true,
    },
]

for (const item of cases) {
    const parsed = parseGitInput(item.input)
    assert.equal(parsed.repositoryUrl, item.repositoryUrl, item.input)
    assert.equal(parsed.fullName, item.fullName, item.input)
    assert.equal(parsed.sourcePath, '', item.input)
    if (item.reachable) {
        await assertRemoteReachable(item.repositoryUrl)
    }
}

assert.deepEqual(
    describeImportError(new Error('fatal: unable to access https://git.hanasand.com/repo.git: The requested URL returned error: 502')),
    { status: 503, message: 'Git server unavailable. Try again when the remote is reachable.' },
)

assert.deepEqual(
    describeImportError(new Error('ssh: connect to host git.hanasand.com port 22: Connection refused')),
    { status: 503, message: 'Git server unavailable. Try again when the remote is reachable.' },
)

assert.deepEqual(
    describeImportError(new Error('fatal: could not read Username for https://github.com: terminal prompts disabled')),
    { status: 401, message: 'Git authentication failed. Check the repository visibility or attach a valid token.' },
)

console.log('git import complaint e2e passed')

function assertRemoteReachable(repositoryUrl: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('git', ['ls-remote', '--symref', repositoryUrl, 'HEAD'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        const timeout = setTimeout(() => {
            child.kill('SIGTERM')
            reject(new Error(`Timed out checking ${repositoryUrl}`))
        }, 30_000)

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
        })
        child.on('close', (code) => {
            clearTimeout(timeout)
            if (code !== 0) {
                reject(new Error(stderr.trim() || `git ls-remote failed with code ${code}`))
                return
            }
            if (!stdout.includes('refs/heads/')) {
                reject(new Error(`No default branch ref returned for ${repositoryUrl}`))
                return
            }
            resolve()
        })
    })
}
