import { expect, test } from '@playwright/test'

const sharePath = process.env.PLAYWRIGHT_SHARE_PATH || '/s/pwshare_live_probe'

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
    const terminalInput = page.getByRole('textbox', { name: 'Terminal input' })
    await terminalInput.click()

    await expect.poll(async () => {
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
    }, { timeout: 30000 }).toContain(':~$')

    await terminalInput.pressSequentially('pwd')
    await terminalInput.press('Enter')

    await expect.poll(async () => {
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
    }, { timeout: 30000 }).toContain('/home/')

    await terminalInput.pressSequentially('ls')
    await terminalInput.press('Enter')

    await expect.poll(async () => {
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
    }, { timeout: 30000 }).not.toContain('Websocket not connected')

    const terminalText = await page.evaluate(() => {
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
    }) + consoleMessages.join('\n')
    expect(terminalText).not.toContain('/home/ubuntu/find_vm.sh\': command not found')
    expect(terminalText).not.toContain('/home/ubuntu/clone_vm.sh\': command not found')
    expect(terminalText).not.toContain('Websocket not connected')
})
