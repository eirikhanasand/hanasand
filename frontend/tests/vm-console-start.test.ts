import { expect, test } from 'bun:test'
import { prepareVmConsole } from '../src/utils/vms/prepareConsole'

for (const state of ['Running', 'Stopped']) {
    test(`console checks ${state} machine and starts only a stopped machine`, async () => {
        const calls: string[] = [], statuses: string[] = []
        const request = (async (url: string, init: RequestInit) => {
            calls.push(url)
            expect(init.headers).toEqual({ id: 'member', Authorization: 'Bearer session' })
            return Response.json(url.includes('/details/') ? { status: state } : { ok: true })
        }) as typeof fetch
        await prepareVmConsole('my vm', '/api', 'member', 'session', message => statuses.push(message), new AbortController().signal, request)
        expect(calls).toHaveLength(state === 'Stopped' ? 2 : 1)
        expect(statuses.includes('Starting container…')).toBe(state === 'Stopped')
    })
}
test('failed status and denied starts stop console preparation', async () => {
    for (const failure of ['details', 'start']) {
        const request = (async (url: string) => url.includes(failure === 'details' ? '/details/' : '/start') ? Response.json({ error: 'Denied' }, { status: 403 }) : Response.json({ status: 'Stopped' })) as typeof fetch
        await expect(prepareVmConsole('vm', '/api', 'member', 'session', () => {}, new AbortController().signal, request)).rejects.toThrow()
    }
})
