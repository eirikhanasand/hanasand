import { expect, mock, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import tls from 'node:tls'
import dns from 'node:dns/promises'

mock.module('node:dns/promises', () => ({ ...dns, lookup: async () => [{ address: '93.184.215.14', family: 4 }] }))
let connections = 0

let authorized = true
let expiresAt = new Date(Date.now() + 60 * 86400000).toUTCString()
mock.module('node:tls', () => ({ ...tls, default: tls, connect: (options: tls.ConnectionOptions) => {
    connections++
    expect(options.lookup).toBeFunction()
    expect(options.servername).toBe('example.test')
    const socket = Object.assign(new EventEmitter(), {
        authorized,
        setTimeout() {},
        destroy() {},
        getPeerCertificate: () => ({ valid_to: expiresAt, subject: { CN: 'example.test' }, issuer: { O: 'Test issuer' } }),
    })
    queueMicrotask(() => socket.emit('secureConnect'))
    return socket
} }))
const { certificateTarget, checkCertificate } = await import('../src/utils/automations.ts')

test('certificate inspection covers HTTPS and TLS port checks, excluding plain TCP and SSH', () => {
    expect(certificateTarget({ monitoring_type: 'fetch', target_url: 'https://example.test/path' })?.href).toBe('https://example.test/path')
    expect(certificateTarget({ monitoring_type: 'post', target_url: 'https://example.test:8443/path' })?.port).toBe('8443')
    expect(certificateTarget({ monitoring_type: 'tcp', target_url: 'example.test:443' })?.hostname).toBe('example.test')
    expect(certificateTarget({ monitoring_type: 'tcp', target_url: '[::1]:443' })?.hostname).toBe('[::1]')
    expect(certificateTarget({ monitoring_type: 'tcp', target_url: 'example.test:22' })).toBeNull()
    expect(certificateTarget({ monitoring_type: 'ssh', target_url: 'example.test:443' })).toBeNull()
    expect(certificateTarget({ monitoring_type: 'fetch', target_url: 'http://example.test' })).toBeNull()
})

test('certificate validity requires trust as well as a future expiry date', async () => {
    const target = new URL('https://example.test')
    expect((await checkCertificate(target, 1000)).status).toBe('valid')
    authorized = false
    expect((await checkCertificate(target, 1000)).status).toBe('invalid')
    authorized = true
    expiresAt = new Date(Date.now() + 7 * 86400000).toUTCString()
    expect((await checkCertificate(target, 1000)).status).toBe('expiring')
    expiresAt = new Date(Date.now() - 86400000).toUTCString()
    expect((await checkCertificate(target, 1000)).status).toBe('invalid')
})

test('certificate preflight rejects internal destinations before TLS', async () => {
    const before = connections
    await expect(checkCertificate(new URL('https://127.0.0.1'), 100)).rejects.toThrow('public IP')
    await expect(checkCertificate(new URL('https://[::1]'), 100)).rejects.toThrow('public IP')
    expect(connections).toBe(before)
})
