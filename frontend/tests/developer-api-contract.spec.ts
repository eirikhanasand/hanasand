import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('developer reference matches the mounted API-key search surface', async () => {
    const page = await readFile(path.join(root, 'src/app/developers/page.tsx'), 'utf8')
    const searchRoute = await readFile(path.join(root, 'src/app/api/ti/search/route.ts'), 'utf8')
    const batchRoute = await readFile(path.join(root, 'src/app/api/ti/search/batch/route.ts'), 'utf8')
    const openApi = await readFile(path.join(root, 'src/app/api/openapi/ti/route.ts'), 'utf8')

    for (const value of ['X-API-Key', '/api/ti/search', '/api/ti/search/batch', '/api/openapi/ti']) expect(page).toContain(value)
    expect(page).not.toContain('alertExample')
    expect(searchRoute).toContain('proxyApiTiRequest(request, \'/ti/search\'')
    expect(searchRoute).not.toContain('presentedApiKey')
    expect(batchRoute).toContain('proxyApiTiRequest(request, \'/ti/search/batch\'')
    expect(openApi).toContain('openapi: \'3.1.0\'')
    expect(openApi).toContain('name: \'X-API-Key\'')
    expect(openApi).toContain("enum: ['ready', 'partial', 'searching']")
})
