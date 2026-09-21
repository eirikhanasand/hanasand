import { readFile, stat } from 'node:fs/promises'

export type IndexedCommit = { external_id: string, title: string, author: string, updated_at: string }
type Snapshot = { revision: string, repositories: string[], commits: IndexedCommit[] }
let cached: { modified: number, snapshot: Snapshot } | undefined
let pending: Promise<Snapshot | null> | undefined

export async function repositoryCommitSnapshot(repository: string): Promise<Snapshot | null> {
    pending ??= (async () => {
        const file = process.env.CASE_COMMITS_PATH || '/app/code-review/commits.json'
        try {
            const modified = (await stat(file)).mtimeMs
            if (cached?.modified === modified) return cached.snapshot
            const snapshot = JSON.parse(await readFile(file, 'utf8')) as Snapshot
            if (!Array.isArray(snapshot.repositories) || !Array.isArray(snapshot.commits)) throw new Error('Invalid commit index.')
            cached = { modified, snapshot }
            return snapshot
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
            throw error
        }
    })().finally(() => { pending = undefined })
    const snapshot = await pending
    return snapshot?.repositories.includes(repository) ? snapshot : null
}

export function commitPage(commits: IndexedCommit[], cursor?: string) {
    const index = cursor ? commits.findIndex(commit => commit.external_id === cursor) : -1
    if (cursor && index < 0) return null
    const items = commits.slice(index + 1, index + 101)
    return { items, nextCursor: index + 101 < commits.length ? items.at(-1)!.external_id : null }
}
