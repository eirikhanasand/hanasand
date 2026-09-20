import { expect, test } from 'bun:test'

function configuredApi(browser: boolean) {
    const script = `${browser ? 'globalThis.window = { location: { hostname: \'hanasand.com\', protocol: \'https:\' } };' : ''} const {default: config} = await import('./src/config.ts'); console.log(config.url.api)`
    const result = Bun.spawnSync([process.execPath, '-e', script], { cwd: import.meta.dir + '/..', env: { ...process.env, NODE_ENV: 'production', FRONTEND_INTERNAL_API: 'http://127.0.0.1:28082/api', NEXT_PUBLIC_API: 'http://127.0.0.1:8080/api' } })
    expect(result.exitCode).toBe(0)
    return result.stdout.toString().trim()
}
test('server fetches use the configured internal API while browsers retain the public URL', () => {
    expect(configuredApi(false)).toBe('http://127.0.0.1:28082/api')
    expect(configuredApi(true)).toBe('https://api.hanasand.com/api')
})
