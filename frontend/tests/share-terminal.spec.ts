import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const sharePath = process.env.PLAYWRIGHT_SHARE_PATH || '/s/pwshare_live_probe'

async function readTerminalText(page: Page) {
    return page.evaluate(() => {
        const term = (window as Window & {
            __shareTerminal?: {
                rows: number
                buffer: {
                    active: {
                        getLine: (index: number) => { translateToString: (trimRight?: boolean) => string } | undefined
                    }
                }
            }
        }).__shareTerminal

        if (!term) {
            return ''
        }

        return Array.from({ length: term.rows }, (_, index) =>
            term.buffer.active.getLine(index)?.translateToString(true) || ''
        ).join('\n')
    })
}

async function sendTerminalInput(page: Page, content: string) {
    await page.evaluate((nextContent) => {
        const sendInput = (window as Window & {
            __shareTerminalSendInput?: (content: string) => void
        }).__shareTerminalSendInput

        if (!sendInput) {
            throw new Error('Terminal input bridge is not ready')
        }

        sendInput(nextContent)
    }, content)
}

test('public share terminal runs commands without websocket or script-path failures', async ({ page, baseURL }) => {
    const consoleMessages: string[] = []

    page.on('console', (message) => {
        consoleMessages.push(message.text())
    })

    await page.goto(new URL(sharePath, baseURL).toString(), { waitUntil: 'networkidle' })

    const toggle = page.getByTestId('share-terminal-toggle')
    if (await toggle.isVisible()) {
        await toggle.click()
    }

    const terminal = page.getByTestId('share-terminal-xterm')
    await expect(terminal).toBeVisible()
    await terminal.click()

    await expect.poll(async () => {
        return readTerminalText(page)
    }, { timeout: 30000 }).toContain(':~$')

    await sendTerminalInput(page, 'pwd\r')

    await expect.poll(async () => {
        return readTerminalText(page)
    }, { timeout: 30000 }).toMatch(/pwd[\s\S]*\/.+/)

    await sendTerminalInput(page, 'ls\r')

    await expect.poll(async () => {
        return readTerminalText(page)
    }, { timeout: 30000 }).not.toContain('Websocket not connected')

    const terminalText = await readTerminalText(page) + consoleMessages.join('\n')
    expect(terminalText).not.toContain('/home/ubuntu/find_vm.sh\': command not found')
    expect(terminalText).not.toContain('/home/ubuntu/clone_vm.sh\': command not found')
    expect(terminalText).not.toContain('Websocket not connected')
})
