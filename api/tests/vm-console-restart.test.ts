import { expect, test } from 'bun:test'
import { startConsoleSession } from '../src/utils/vms/consoleSession.ts'

const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) await Bun.sleep(5)
    expect(check()).toBe(true)
}

test('keeps boot output during restart and reconnects the shell without recreating the browser session', async () => {
    const messages: Array<{ type: string; message?: string; data?: string }> = []
    let exit = () => {}, bootOutput = (data: string) => { void data }
    let state = 'Running', shells = 0, closes = 0
    const input: string[] = []
    const session = startConsoleSession('cashflow', message => messages.push(message as typeof messages[number]), {
        state: async () => state,
        boot: async (_name, output) => { bootOutput = output; return { close: () => { closes++ } } },
        shell: async (_name, _output, onExit) => {
            shells++; exit = onExit
            return { username: 'cashflow', close: () => { closes++ }, write: value => { input.push(value) }, resize: () => {} }
        },
    }, 5)
    try {
        await waitFor(() => shells === 1)
        bootOutput('reboot: Restarting system\r\n')
        state = 'Stopped'; exit()
        await waitFor(() => messages.some(message => message.message?.includes('(stopped)')))
        session.write('must not reach boot console')
        expect(input).toEqual([])
        bootOutput('\u001b[32m[ OK ]\u001b[0m Starting services\r\n')
        state = 'Running'
        await waitFor(() => shells === 2)
        expect(messages.filter(message => message.type === 'ready')).toHaveLength(2)
        expect(messages.some(message => message.type === 'boot-output' && message.data === '[ OK ] Starting services\n')).toBe(true)
        expect(messages.some(message => message.type === 'closed')).toBe(false)
        session.write('whoami\r')
        expect(input).toEqual(['whoami\r'])
    } finally { session.close() }
    expect(closes).toBe(2)
})

test('ordinary shell exit reconnects without claiming the VM restarted; failed agent and host checks retry', async () => {
    const statuses: string[] = []
    let exit = () => {}, calls = 0, states = 0, ready = 0
    const session = startConsoleSession('cashflow', message => {
        const value = message as { type: string; message: string }
        if (value.type === 'ready') ready++
        if (value.type === 'status') statuses.push(value.message)
    }, {
        state: async () => { if (++states === 2) throw new Error('host temporarily down'); return 'Running' },
        boot: async () => ({ close: () => {} }),
        shell: async (_name, _output, onExit) => {
            if (++calls === 2) throw new Error('agent unavailable')
            exit = onExit
            return { username: 'cashflow', close: () => {}, write: () => {}, resize: () => {} }
        },
    }, 5)
    try {
        await waitFor(() => ready === 1); exit()
        await waitFor(() => ready === 2)
        expect(statuses.some(status => status.includes('restarting'))).toBe(false)
        expect(statuses.some(status => status.includes('Retrying automatically'))).toBe(true)
    } finally { session.close() }
})

test('closing during connection closes late channels and stops all further output and retries', async () => {
    let release: (value: string) => void = () => {}, calls = 0
    const session = startConsoleSession('cashflow', () => { throw new Error('Output after close') }, {
        state: () => new Promise(resolve => { release = resolve }),
        boot: async () => { calls++; return { close: () => {} } },
        shell: async () => { throw new Error('Unexpected shell') },
    }, 5)
    session.close(); release('Running')
    await Bun.sleep(20)
    expect(calls).toBe(0)
})
