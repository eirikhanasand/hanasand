import { afterEach, expect, test } from 'bun:test'
import { downloadBlob, uploadAttachment } from '../src/utils/mail/jmap.ts'
import { mailConfig } from '../src/utils/mail/config.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function mailFetch(status = 200) {
    const transfers: Array<{ url: URL, options?: RequestInit }> = []
    globalThis.fetch = (async (input, options) => {
        const url = new URL(String(input))
        if (url.pathname === '/jmap/session') return Response.json({
            apiUrl: 'http://retired-container:8080/jmap/',
            downloadUrl: 'http://retired-container:8080/jmap/download/{accountId}/{blobId}/{name}?accept={type}',
            uploadUrl: 'http://retired-container:8080/jmap/upload/{accountId}/',
            primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' },
        })
        transfers.push({ url, options })
        if (url.origin !== new URL(mailConfig.internalUrl).origin) throw new Error('Connection refused: retired container')
        return options?.method === 'POST'
            ? Response.json({ blobId: 'new-blob', size: 3, type: 'application/zip' }, { status })
            : new Response(new Uint8Array([80, 75, 3, 4]), { status, headers: { 'Content-Type': 'application/zip' } })
    }) as typeof fetch
    return transfers
}

test('downloads use the configured mail service, preserving path, query and authentication', async () => {
    const transfers = mailFetch()
    const response = await downloadBlob('user', 'secret', 'blob/id', 'google!report & domain.zip')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([80, 75, 3, 4])
    expect(response.headers.get('content-type')).toBe('application/zip')
    expect(transfers[0].url.pathname).toBe('/jmap/download/account/blob%2Fid/google!report%20%26%20domain.zip')
    expect(transfers[0].url.searchParams.get('accept')).toBe('*/*')
    expect(new Headers(transfers[0].options?.headers).get('authorization')).toBe(`Basic ${btoa('user:secret')}`)
})

test('uploads also survive replacement of the mail container', async () => {
    const transfers = mailFetch()
    expect(await uploadAttachment('user', 'secret', 'report.zip', 'application/zip', 'YWJj')).toMatchObject({ blobId: 'new-blob', size: 3 })
    expect(transfers[0].url.pathname).toBe('/jmap/upload/account/')
    expect(transfers[0].options?.body).toBeInstanceOf(FormData)
})

test('a failed attachment fetch remains an error', async () => {
    mailFetch(404)
    await expect(downloadBlob('user', 'secret', 'missing', 'report.zip')).rejects.toThrow('Unable to fetch blob (404)')
})
