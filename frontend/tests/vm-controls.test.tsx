import { strict as assert } from 'node:assert'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import VMHardware from '../src/components/vms/vmHardware'
import manageVM from '../src/utils/vms/fetch/manage/manage'

test('VM actions encode instance names and preserve plain-text API failures', async () => {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=playwright-token; id=playwright-user' },
    })

    const originalFetch = globalThis.fetch
    let request: { url: string, authorization: string, id: string } | undefined
    try {
        globalThis.fetch = async (input, init) => {
            const headers = new Headers(init?.headers)
            request = {
                url: String(input),
                authorization: headers.get('authorization') || '',
                id: headers.get('id') || '',
            }
            return new Response('VM host is temporarily unavailable', { status: 503 })
        }

        assert.equal(await manageVM('folder/test vm', 'start'), 'VM host is temporarily unavailable')
        assert.match(request?.url || '', /\/vm\/folder%2Ftest%20vm\/start$/)
        assert.equal(request?.authorization, 'Bearer playwright-token')
        assert.equal(request?.id, 'playwright-user')
    } finally {
        globalThis.fetch = originalFetch
        Reflect.deleteProperty(globalThis, 'document')
    }
})

test('VM hardware renders user-facing placeholders without a route fixture', () => {
    const html = renderToStaticMarkup(<VMHardware boxStyle='' boxTitleStyle='' vm={{ name: 'test', status: 'stopped' } as VM} />)
    assert.equal(html.match(/Not reported/g)?.length, 3)
    assert(!html.includes('missing'))
})
