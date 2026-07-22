import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('developer reference is rendered from the canonical versioned contract', async () => {
    const page = await readFile(path.join(root, 'src/app/developers/page.tsx'), 'utf8')
    const openApiProxy = await readFile(path.join(root, 'src/app/api/openapi/ti/route.ts'), 'utf8')
    const copyButton = await readFile(path.join(root, 'src/app/developers/copyCodeButton.tsx'), 'utf8')

    expect(page).toContain('/v1/openapi.json')
    expect(page).toContain('Object.entries(contract.paths)')
    expect(page).toContain('openapi-typescript')
    expect(page).toContain('openapi-fetch')
    expect(page).toContain('firstProtected.path')
    expect(page).not.toContain('const endpoints = [')
    expect(page).not.toContain('/api/ti/search')
    expect(openApiProxy).toContain('/v1/openapi.json')
    expect(openApiProxy).toContain('\'cache-control\': \'no-store, max-age=0\'')
    expect(openApiProxy).toContain('openapi_unavailable')
    expect(copyButton).toContain('navigator.clipboard.writeText(value)')
    expect(copyButton).toContain('document.execCommand(\'copy\')')
    expect(copyButton).toContain('setCopied(true)')
})
