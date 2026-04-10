import git, { ensureRepo } from './git.ts'

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
    try {
        await git('rev-parse --abbrev-ref --symbolic-full-name @{u}')
    } catch {
        console.log('Setting upstream to origin/main')
        await git('branch --set-upstream-to=origin/main main')
    }

    await git('pull --rebase', 60000)
    lastRefresh = Date.now()
}
