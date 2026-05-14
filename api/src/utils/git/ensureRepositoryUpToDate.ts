import { access } from 'fs/promises'
import { join } from 'path'
import git, { ensureRepo, LOCAL_REPO_PATH } from './git.ts'

const refreshIntervalMs = 300000
let lastRefresh = 0
let refreshPromise: Promise<void> | null = null

export default async function ensureRepositoryUpToDate() {
    await ensureRepo()

    const now = Date.now()
    if (refreshPromise) {
        return refreshPromise
    }

    if (now - lastRefresh < refreshIntervalMs) {
        return
    }

    refreshPromise = refreshRepository().finally(() => {
        refreshPromise = null
    })

    return refreshPromise
}

async function refreshRepository() {
    if (!(await hasGitMetadata())) {
        lastRefresh = Date.now()
        return
    }

    const workingTreeStatus = await git('status --porcelain')
    if (workingTreeStatus.trim()) {
        lastRefresh = Date.now()
        return
    }

    try {
        await git('rev-parse --abbrev-ref --symbolic-full-name @{u}')
    } catch {
        console.log('Setting upstream to origin/main')
        await git('branch --set-upstream-to=origin/main main')
    }

    await git('pull --rebase', 60000)
    lastRefresh = Date.now()
}

async function hasGitMetadata() {
    try {
        await access(join(LOCAL_REPO_PATH, '.git'))
        return true
    } catch {
        return false
    }
}
