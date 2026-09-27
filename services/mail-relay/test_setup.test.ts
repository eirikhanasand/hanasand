import { describe, expect, test } from 'bun:test'
import { mailAdmin, parseAdmin, start } from './setup.ts'

const config = '[authentication.fallback-admin]\nuser = "relay-admin"\nsecret = "test-secret"\n'
const current = (source = '/old/health', image = 'health:old') => ({ Config: { Image: image }, Mounts: [{ Source: source, Destination: '/run/config' }],
    NetworkSettings: { Networks: { private: { IPAddress: '172.30.0.8' } } } })

describe('mail relay setup', () => {
    test('reads fallback admin credentials from Stalwart TOML, including private-container fallback', () => {
        expect(parseAdmin(config)).toEqual({ user: 'relay-admin', secret: 'test-secret' })
        const readContainer = () => config
        expect(mailAdmin('/private/config.toml', () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }) }, readContainer)).toEqual({ user: 'relay-admin', secret: 'test-secret' })
        expect(() => parseAdmin('[authentication]\nuser = "missing"')).toThrow('fallback-admin')
    })

    test('replaces a stateless container when its bind mount changes', () => {
        const calls: string[][] = []
        start('health', 'health:latest', 'private', ['/new/health:/run/config:ro'], [], [], [], {
            exists: () => true, inspect: () => current(), run: (args: string[]) => calls.push(args),
        })
        expect(calls.map(args => args[1])).toEqual(['stop', 'rm', 'run'])
        expect(calls[0]).toEqual(['docker', 'stop', '-t', '15', 'health'])
        expect(calls[2]).toContain('/new/health:/run/config:ro')
    })

    test('restarts a matching Inspur connector and preserves its address on replacement', () => {
        const calls: string[][] = []
        start('hanasand-mail-relay-inspur', 'health:latest', 'private', ['/new/health:/run/config:ro'], [], [], [], {
            exists: () => true, inspect: () => current('/new/health', 'health:latest'), run: (args: string[]) => calls.push(args),
        })
        expect(calls).toEqual([['docker', 'restart', 'hanasand-mail-relay-inspur']])
        calls.length = 0
        start('hanasand-mail-relay-inspur', 'health:new', 'private', ['/new/health:/run/config:ro'], [], [], [], {
            exists: () => true, inspect: () => current('/new/health', 'health:latest'), run: (args: string[]) => calls.push(args),
        })
        expect(calls[2]).toContain('--ip')
        expect(calls[2]).toContain('172.30.0.8')
    })
})
