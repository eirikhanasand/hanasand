import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
test.use({ baseURL: 'http://127.0.0.1:3265' })
test.skip(process.env.THESIS_CODE_LIVE_TEST !== '1', 'Requires the isolated live-inventory fixture.')
test('Git pushes update the open page and preserve age-based review priority', async({ page, context, request }) => {
    test.setTimeout(180000)
    const published = '/tmp/thesis-code-live-published', directory = await fs.mkdtemp(path.join(os.tmpdir(), 'code-review-git-'))
    const backup = await fs.readFile(path.join(published, 'current.json')), backupStatus = await fs.readFile(path.join(published, 'status.json'))
    const work = path.join(directory, 'work'), remote = path.join(directory, 'remote.git'), mirror = path.join(directory, 'mirror.git')
    const git = (...args: string[]) => run('git', args)
    const source = (name: string) => 'frontend/src/app/' + name
    const write = (name: string, value: string) => fs.writeFile(path.join(work, source(name)), value)
    let worker: ReturnType<typeof spawn> | undefined
    try {
        await fs.mkdir(path.join(work, 'frontend/src/app'), { recursive: true })
        await git('init', '-b', 'main', work)
        await git('-C', work, 'config', 'user.name', 'Code review test')
        await git('-C', work, 'config', 'user.email', 'code-review-test@example.invalid')
        await write('page.tsx', 'import value from \'./priority-a-recent\'; export default value')
        await write('priority-a-recent.ts', 'export default 1')
        await write('priority-b-old.ts', 'export default 1')
        await git('-C', work, 'add', '.')
        await git('-C', work, 'commit', '-m', 'Initial review fixture')
        await git('clone', '--bare', work, remote)
        await git('clone', '--bare', remote, mirror)
        await git('--git-dir=' + mirror, 'remote', 'add', 'github', remote)
        const revision = (await git('-C', work, 'rev-parse', 'HEAD')).stdout.trim()
        worker = spawn('node', [path.resolve('scripts/code-inventory-watch.mjs'), mirror, published], { stdio: 'ignore' })
        await expect.poll(async() => JSON.parse(await fs.readFile(path.join(published, 'current.json'), 'utf8')).revision, { timeout: 20000 }).toBe(revision)
        await context.addCookies([{ name: 'id', value: 'eirikhanasand', url: 'http://127.0.0.1:3265' }, { name: 'access_token', value: 'synthetic-owner', url: 'http://127.0.0.1:3265' }])
        await page.routeWebSocket('**/api/ws/thesis', socket => socket.close())
        const document = await (await request.get('http://127.0.0.1:3262/api/thesis')).json()
        const metadata = [{ id: 'Code', name: 'Code', title: '# Code', length: 0 }]
        expect((await request.put('http://127.0.0.1:3262/api/thesis', { headers: { id: 'eirikhanasand', Authorization: 'Bearer synthetic-owner' }, data: { ...document, body: '<!-- thesis-workspace:2 ' + encodeURIComponent(JSON.stringify(metadata)) + ' -->\n' } })).ok()).toBe(true)
        await page.goto('/thesis?sheet=Code')
        await expect(page.getByRole('combobox', { name: 'Sort code inventory' })).toBeVisible({ timeout: 60000 })
        const before = await (await page.request.get('/api/thesis/code')).json()
        const target = (name: string) => before.nodes.find((item: { id: string }) => item.id === 'source:' + source(name))
        for (const name of ['priority-a-recent.ts', 'priority-b-old.ts']) {
            const item = target(name)
            expect((await page.request.post('/api/thesis/code', { headers: { Origin: 'http://127.0.0.1:3265' }, data: { id: item.id, sha256: item.sha256, reviewHash: item.reviewHash, approved: true, eventId: crypto.randomUUID() } })).ok()).toBe(true)
        }
        await run('docker', ['exec', 'thesis-code-db', 'psql', '-U', 'hanasand', '-d', 'hanasand', '-c', 'UPDATE code_review_events SET reviewed_at = NOW() - INTERVAL \'15 days\' WHERE item_id = \'source:frontend/src/app/priority-b-old.ts\''])
        await page.getByRole('textbox', { name: 'Search code inventory' }).fill('priority-')
        await page.getByRole('button', { name: 'Refresh', exact: true }).click()
        const list = page.getByRole('complementary', { name: 'Alphabetical code inventory' })
        await expect(list.locator('[data-priority="2"]')).toHaveCount(2)
        await write('priority-a-recent.ts', 'export default 2')
        await write('priority-b-old.ts', 'export default 2')
        await write('priority-c-new.ts', 'export default 3')
        await git('-C', work, 'add', '.')
        await git('-C', work, 'commit', '-m', 'Changed and new source fixture')
        await git('-C', work, 'push', remote, 'main')
        // No reload or Refresh: the running watcher and client polling must carry the push through.
        await expect(list.getByRole('button').filter({ hasText: 'priority-c-new.ts' })).toBeVisible({ timeout: 20000 })
        await expect(list.getByRole('button').filter({ hasText: 'priority-a-recent.ts' }).locator('[data-priority="1"]')).toBeVisible()
        await expect(list.getByRole('button').filter({ hasText: 'priority-b-old.ts' }).locator('[data-priority="0"]')).toBeVisible()
        await expect(list.getByRole('button').filter({ hasText: 'priority-c-new.ts' }).locator('[data-priority="0"]')).toBeVisible()
        await expect(list.getByRole('button')).toHaveText(['frontend/src/app/priority-b-old.ts', 'frontend/src/app/priority-c-new.ts', 'frontend/src/app/priority-a-recent.ts'])
        await page.getByRole('combobox', { name: 'Sort code inventory' }).selectOption('alphabetical')
        await expect(list.getByRole('button')).toHaveText(['frontend/src/app/priority-a-recent.ts', 'frontend/src/app/priority-b-old.ts', 'frontend/src/app/priority-c-new.ts'])
        await list.getByRole('button').filter({ hasText: 'priority-a-recent.ts' }).click()
        await page.getByRole('button', { name: 'Review status: Needs new review', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Review history' })).toContainText('Approved')
        const after = await (await page.request.get('/api/thesis/code')).json()
        const beforePage = before.nodes.find((item: { kind: string }) => item.kind === 'frontend'), afterPage = after.nodes.find((item: { kind: string }) => item.kind === 'frontend')
        expect(afterPage.sha256).toBe(beforePage.sha256)
        expect(afterPage.reviewHash).not.toBe(beforePage.reviewHash)
        await page.screenshot({ path: '/tmp/thesis-code-live-priority.png', fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        await expect.poll(() => page.locator('.code-detail pre').evaluate(element => element.getBoundingClientRect().right <= window.innerWidth)).toBe(true)
    } finally {
        if (worker && worker.exitCode === null && worker.signalCode === null) { worker.kill('SIGTERM'); await new Promise(resolve => worker!.once('exit', resolve)) }
        await fs.writeFile(path.join(published, 'current.json'), backup)
        await fs.writeFile(path.join(published, 'status.json'), backupStatus)
        await fs.rm(directory, { recursive: true, force: true })
    }
})
