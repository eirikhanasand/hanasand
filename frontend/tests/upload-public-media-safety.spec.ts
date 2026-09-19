import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('upload utility is framed as public media and blocks unsafe proxy targets', async () => {
    const uploadPage = await readFile(path.join(root, 'src/app/upload/pageClient.tsx'), 'utf8')
    const uploadForm = await readFile(path.join(root, 'src/components/upload/upload.tsx'), 'utf8')
    const preview = await readFile(path.join(root, 'src/components/upload/preview.tsx'), 'utf8')
    const imageRoute = await readFile(path.join(root, 'src/app/api/image/route.ts'), 'utf8')

    expect(uploadPage).toContain('data-upload-safety-boundary')
    expect(uploadPage).toContain('For public media only.')
    expect(uploadPage).toContain('Don’t upload private, confidential, or sensitive files.')
    expect(uploadForm).toContain('Choose public photo or video')
    expect(uploadForm).toContain('Choose a file or paste a image/video URL.')
    expect(uploadForm).toContain('MAX_PUBLIC_MEDIA_BYTES')
    expect(uploadForm).toContain('validatePublicMediaFile(file)')
    expect(uploadForm).toContain('Only public image or video files can be uploaded here.')
    expect(uploadForm).toContain('Public media must be 20 MB or smaller.')
    expect(uploadForm).toContain('payload.error || \'Remote media could not be fetched.\'')
    expect(preview).toContain('publish only if this can be shared outside your organization')

    expect(imageRoute).toContain('MAX_PROXY_BYTES')
    expect(imageRoute).toContain('URL must point to a public media host.')
    expect(imageRoute).toContain('URL must return an image or video.')
    expect(imageRoute).toContain('isBlockedHostname')
    expect(imageRoute).toContain('PRIVATE_IPV4_RANGES')
    expect(imageRoute).toContain('cache-control')
    expect(imageRoute).not.toContain('console.log(await response.text())')
})

test('upload page renders public-media safety boundary', async ({ page }) => {
    await page.goto('/upload')

    await expect(page.getByRole('heading', { name: 'Upload files' })).toBeVisible()
    const boundary = page.locator('[data-upload-safety-boundary="true"]')
    await expect(boundary).toContainText('For public media only.')
    await expect(boundary).toContainText('Don’t upload private, confidential, or sensitive files.')
    await expect(page.getByText('Choose public photo or video')).toBeVisible()
})
