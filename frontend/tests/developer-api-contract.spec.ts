import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('developer reference is rendered from the canonical versioned contract', async () => {
    const page = await readFile(path.join(root, 'src/app/developers/page.tsx'), 'utf8')
    const openApiProxy = await readFile(path.join(root, 'src/app/api/openapi/ti/route.ts'), 'utf8')
    const copyButton = await readFile(path.join(root, 'src/app/developers/copyCodeButton.tsx'), 'utf8')
    const onboarding = await readFile(path.join(root, 'src/app/developers/apiKeyOnboarding.tsx'), 'utf8')

    expect(page).toContain('/v1/openapi.json')
    expect(page).toContain('Object.entries(contract.paths)')
    expect(page).toContain('openapi-typescript')
    expect(page).toContain('openapi-fetch')
    expect(page).toContain('firstProtected.path')
    expect(page).toContain('operationAccessLabel(operation.security)')
    expect(page).toContain('if (apiKey && session) return \'API key or session\'')
    expect(page).toContain('if (apiKey) return \'API key\'')
    expect(page).not.toContain('const endpoints = [')
    expect(page).not.toContain('/api/ti/search')
    expect(page).toContain('<ApiKeyOnboarding server={server} />')
    expect(page).not.toContain('/contact?intent=api')
    expect(openApiProxy).toContain('/v1/openapi.json')
    expect(openApiProxy).toContain('\'cache-control\': \'no-store, max-age=0\'')
    expect(openApiProxy).toContain('openapi_unavailable')
    expect(copyButton).toContain('navigator.clipboard.writeText(value)')
    expect(copyButton).toContain('document.execCommand(\'copy\')')
    expect(copyButton).toContain('setCopied(true)')
    expect(onboarding).toContain('/api/backend/organizations/${encodeURIComponent(organizationId)}/api-keys')
    expect(onboarding).toContain('Organization, API key, first request.')
    expect(onboarding).toContain('X-API-Key: ${secret || \'$HANASAND_API_KEY\'}')
    expect(onboarding).not.toContain('hsk_demo')
})
