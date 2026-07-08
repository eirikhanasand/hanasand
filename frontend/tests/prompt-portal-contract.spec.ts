import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('prompt portal keeps unauthenticated access code gated and queue based', async () => {
    const page = await readFile(path.join(root, 'src/app/prompt/page.tsx'), 'utf8')
    const client = await readFile(path.join(root, 'src/app/prompt/promptPortalClient.tsx'), 'utf8')
    const route = await readFile(path.join(root, 'src/app/api/prompt/route.ts'), 'utf8')
    const worker = await readFile(path.join(root, 'src/app/api/prompt/worker/route.ts'), 'utf8')
    const store = await readFile(path.join(root, 'src/utils/promptPortal/store.ts'), 'utf8')

    expect(page).toContain('PromptPortalClient')
    expect(client).toContain('Input queue')
    expect(client).toContain('Output queue')
    expect(client).toContain('type=\'file\' accept=\'image/*\' multiple')
    expect(client).toContain('priority === \'now\'')
    expect(route).toContain('action !== \'login\'')
    expect(route).toContain('createPromptPortalSession')
    expect(route).toContain('promptPortalReadOnly')
    expect(worker).toContain('Do not answer in Codex chat.')
    expect(worker).toContain('promptPortalWorkerToken')
    expect(store).toContain('PROMPT_PORTAL_CODE_HASHES')
    expect(store).toContain('PROMPT_PORTAL_WORKER_TOKEN')
    expect(store).toContain('const IDLE_MS = 15 * 60 * 1000')
    expect(store).toContain('timingSafeEqual')
    expect(store).toContain('items: authenticated ?')
})
