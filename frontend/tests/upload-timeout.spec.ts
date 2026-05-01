import { expect, test } from '@playwright/test'
import { uploadTimeoutForFileSize } from '@/utils/files/uploadTimeout'

test('upload timeout allows a 10.2 MiB image more than the old 30 second abort window', () => {
    const tenPointTwoMiB = Math.ceil(10.2 * 1024 * 1024)

    expect(uploadTimeoutForFileSize(tenPointTwoMiB, 30_000)).toBeGreaterThan(30_000)
    expect(uploadTimeoutForFileSize(tenPointTwoMiB, 30_000)).toBe(230_000)
})
