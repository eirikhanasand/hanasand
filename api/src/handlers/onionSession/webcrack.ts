import type { Page } from 'playwright'

type WebCrackOutput = { code?: string; error?: string }
type OutputWindow = Window & { __hanasandWebCrackOutput?: WebCrackOutput }

// Observe WebCrack's completed worker result, not its virtualized editor or input.
export async function watchWebCrackOutput(page: Page) {
    await page.addInitScript(() => {
        const NativeWorker = window.Worker
        window.Worker = class extends NativeWorker {
            constructor(url: string | URL, options?: WorkerOptions) {
                super(url, options)
                this.addEventListener('message', ({ data }) => {
                    if (data?.type === 'result' && typeof data.code === 'string') {
                        ;(window as OutputWindow).__hanasandWebCrackOutput = { code: data.code.slice(0, 500_000) }
                    } else if (data?.type === 'error') {
                        ;(window as OutputWindow).__hanasandWebCrackOutput = { error: String(data.error?.message || data.error || 'Deobfuscation failed').slice(0, 500) }
                    }
                })
            }
        }
    })
}

export async function readWebCrackOutput(page: Page): Promise<WebCrackOutput> {
    try {
        await page.waitForFunction(() => Boolean((window as OutputWindow).__hanasandWebCrackOutput), undefined, { timeout: 15_000 })
        return await page.evaluate(() => (window as OutputWindow).__hanasandWebCrackOutput || {})
    } catch {
        return { error: 'WebCrack did not return deobfuscated code within 15 seconds.' }
    }
}

export async function submitWebCrackSample(page: Page, sample: string) {
    const editor = page.locator('.monaco-editor').first()
    let action: string
    if (await editor.count()) {
        await editor.click({ timeout: 2500 })
        await page.keyboard.press('ControlOrMeta+KeyA')
        await page.keyboard.insertText(sample)
        action = 'inserted_editor_text'
    } else {
        const textarea = page.locator('textarea').first()
        const editable = page.locator('[contenteditable="true"]').first()
        if (await textarea.count()) {
            await textarea.fill(sample, { timeout: 2500 })
            action = 'filled_textarea'
        } else if (await editable.count()) {
            await editable.fill(sample, { timeout: 2500 })
            action = 'filled_contenteditable'
        } else return undefined
    }
    const runButton = page.getByRole('button', { name: /deobfuscate|unpack|analy[sz]e|run|crack/i }).first()
    if (await runButton.count()) await runButton.click({ timeout: 2500 })
    else await page.keyboard.press('Alt+Enter')
    return action
}
