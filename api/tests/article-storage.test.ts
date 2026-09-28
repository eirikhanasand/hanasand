import { expect, mock, test } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

mock.module('../src/constants.ts', () => ({ default: { github_articles_ssh: 'unused-for-local-content' } }))
test('persistent articles read and save without network access or losing Git dates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-ownership-articles-'))
    const previous = process.env.ARTICLES_REPO_PATH
    process.env.ARTICLES_REPO_PATH = directory
    try {
        execFileSync('git', ['init', '-q', directory])
        execFileSync('git', ['-C', directory, 'config', 'user.name', 'Content test'])
        execFileSync('git', ['-C', directory, 'config', 'user.email', 'content-test@example.test'])
        await mkdir(join(directory, 'articles'))
        const file = join(directory, 'articles', 'example.md')
        await writeFile(file, '# Original')
        execFileSync('git', ['-C', directory, 'add', 'articles'])
        execFileSync('git', ['-C', directory, 'commit', '-qm', 'Initial content'], { env: { ...process.env, GIT_AUTHOR_DATE: '2025-01-01T12:00:00Z', GIT_COMMITTER_DATE: '2025-01-01T12:00:00Z' } })
        const { ensureRepo, ARTICLES_DIR } = await import('../src/utils/git/git.ts')
        const { default: refresh } = await import('../src/utils/git/ensureRepositoryUpToDate.ts')
        const { default: save } = await import('../src/utils/git/commitAndPush.ts')
        const { default: createdAt } = await import('../src/utils/git/createdAt.ts')
        const { default: updatedAt } = await import('../src/utils/git/updatedAt.ts')
        await ensureRepo(); await refresh()
        expect(ARTICLES_DIR).toBe(join(directory, 'articles'))
        expect(await createdAt(file)).toContain('2025-01-01')
        expect(await updatedAt(file)).toContain('2025-01-01')
        await writeFile(file, '# Updated')
        await save('Update article')
        await save('No duplicate empty commit')
        expect(execFileSync('git', ['-C', directory, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim()).toBe('2')
        expect(await createdAt(file)).toContain('2025-01-01')
    } finally {
        if (previous === undefined) delete process.env.ARTICLES_REPO_PATH
        else process.env.ARTICLES_REPO_PATH = previous
        await rm(directory, { recursive: true, force: true })
    }
})
