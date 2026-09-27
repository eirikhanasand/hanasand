#!/usr/bin/env bun
/** Run from the pushed Git revision on the selected host; never prints secrets. */
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, writeFileSync, closeSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export const STALWART_IMAGE = 'stalwartlabs/stalwart@sha256:b6c2a04a79695136d5e2c16e9da0254135d0c3f3b1f8147873e812916b0ae8c4'
export const ROOT = path.join(homedir(), 'hanasand/mail/mail-relay')
const run = (args: string[], options: { capture?: boolean; input?: string; ignore?: boolean } = {}) => {
    const result = spawnSync(args[0], args.slice(1), { encoding: 'utf8', input: options.input,
        stdio: options.input !== undefined ? ['pipe', options.capture ? 'pipe' : 'inherit', options.capture ? 'pipe' : 'inherit'] : options.ignore ? 'ignore' : options.capture ? 'pipe' : 'inherit' })
    if (result.status !== 0) throw new Error(result.stderr || `${args[0]} failed with status ${result.status}`)
    return result.stdout || ''
}
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'))
export function writeSecret(file: string, value: string) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    const temporary = `${file}.tmp`
    const fd = openSync(temporary, 'w', 0o600)
    try { writeFileSync(fd, value) } finally { closeSync(fd) }
    chmodSync(temporary, 0o600)
    renameSync(temporary, file)
}
export function credentials() {
    const file = path.join(ROOT, 'credentials.json')
    if (!existsSync(file)) writeSecret(file, JSON.stringify(Object.fromEntries(['admin', 'relay', 'health'].map(key => [key, randomBytes(36).toString('base64url')]))))
    return readJson(file)
}
export function parseAdmin(toml: string) {
    const sectionStart = toml.indexOf('[authentication.fallback-admin]')
    if (sectionStart < 0) throw new Error('Stalwart fallback-admin is not configured')
    const rest = toml.slice(sectionStart + '[authentication.fallback-admin]'.length)
    const section = rest.slice(0, rest.search(/^\s*\[/m) < 0 ? undefined : rest.search(/^\s*\[/m))
    const read = (key: string) => {
        const match = section.match(new RegExp(`^${key}\\s*=\\s*("(?:\\\\.|[^"\\\\])*"|'[^']*')\\s*$`, 'm'))
        if (!match) throw new Error(`Stalwart fallback-admin ${key} is missing`)
        return match[1].startsWith('"') ? JSON.parse(match[1]) : match[1].slice(1, -1)
    }
    return { user: read('user'), secret: read('secret') }
}
export function mailAdmin(file = '/home/hanasand/hanasand/mail/stalwart/etc/config.toml', read = (filename: string) => readFileSync(filename, 'utf8'), containerRead = () => execFileSync('docker', ['exec', 'hanasand_mail', 'cat', '/opt/stalwart/etc/config.toml'], { encoding: 'utf8' })) {
    let contents: string
    try { contents = read(file) }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EACCES') throw error
        contents = containerRead()
    }
    return parseAdmin(contents)
}
export async function api(base: string, username: string, password: string, endpoint: string, body?: unknown, method?: string) {
    const response = await fetch(base + '/api' + endpoint, { method: method || (body === undefined ? 'GET' : 'POST'),
        headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) })
    const data = await response.json() as any
    if (!response.ok && data.error !== 'notFound') throw new Error(`Mail configuration request failed: ${data.error || `HTTP ${response.status}`}`)
    if (data.error && data.error !== 'notFound') throw new Error(`Mail configuration request failed: ${data.error}`)
    return data
}
export async function ensurePrincipal(base: string, admin: any, principal: any) {
    if (!(await api(base, admin.user, admin.secret, `/principal/${principal.name}`)).data)
        await api(base, admin.user, admin.secret, '/principal', principal)
}

export function start(name: string, image: string, network: string, volumes: string[], ports: string[], aliases: string[] = [], extra: string[] = [], dependencies: any = {}) {
    const execute = dependencies.run || ((args: string[]) => run(args, { ignore: true }))
    const exists = dependencies.exists || ((container: string) => spawnSync('docker', ['inspect', container], { stdio: 'ignore' }).status === 0)
    const inspectContainer = dependencies.inspect || ((container: string) => JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0])
    let previousIp: string | undefined
    const found = exists(name)
    if (found) {
        const current = inspectContainer(name)
        const expectedMounts = volumes.map(volume => [path.resolve(volume.split(':')[0]), volume.split(':')[1]].join('\0')).sort()
        const actualMounts = (current.Mounts || []).map((mount: any) => [path.resolve(mount.Source), mount.Destination].join('\0')).sort()
        if (current.Config.Image === image && JSON.stringify(actualMounts) === JSON.stringify(expectedMounts)) {
            execute(['docker', name === 'hanasand-mail-relay-ovh' ? 'start' : 'restart', name])
            return
        }
        previousIp = current.NetworkSettings.Networks[network]?.IPAddress
        if (name === 'hanasand-mail-relay-ovh') throw new Error('Relay image changes require a reviewed upgrade.')
        execute(['docker', 'stop', '-t', '15', name])
        execute(['docker', 'rm', name])
    }
    const command = ['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', network,
        '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--read-only',
        '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '--memory', '512m', '--cpus', '1', '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3', '--stop-timeout', '30']
    if (previousIp && name === 'hanasand-mail-relay-inspur') command.push('--ip', previousIp)
    for (const alias of aliases) command.push('--network-alias', alias)
    for (const volume of volumes) command.push('-v', volume)
    for (const port of ports) command.push('-p', port)
    execute([...command, ...extra, image])
}
export function refreshTls() {
    for (const filename of ['fullchain.pem', 'privkey.pem']) {
        const value = execFileSync('docker', ['exec', 'openresty', 'cat', `/etc/letsencrypt/live/hanasand.com/${filename}`], { encoding: 'utf8' })
        writeSecret(path.join(ROOT, 'tls', filename), value)
    }
}
export async function refreshOvhCertificate() {
    const previous = readFileSync(path.join(ROOT, 'tls/fullchain.pem'))
    refreshTls()
    if (!previous.equals(readFileSync(path.join(ROOT, 'tls/fullchain.pem')))) {
        const result = await api('http://127.0.0.1:18081', 'admin', credentials().admin, '/reload/certificate')
        if (result.data?.errors) throw new Error('Relay certificate reload failed')
        console.log('Relay TLS certificate renewed and reloaded.')
    }
}
export function installCertificateRefresh(revision: string) {
    if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('A full pushed Git revision is required')
    const repo = path.join(homedir(), 'hanasand')
    run(['git', '-C', repo, 'cat-file', '-e', `${revision}:services/mail-relay/setup.ts`], { ignore: true })
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
    const command = `git -C ${quote(repo)} show ${revision}:services/mail-relay/setup.ts | /home/hanasand/.bun/bin/bun - ovh --refresh-tls`
    const line = `17 * * * * /usr/bin/flock -n ${quote(path.join(ROOT, 'renewal.lock'))} /bin/bash -o pipefail -c ${quote(command)} 2>&1 | /usr/bin/logger -t hanasand-mail-relay-tls # hanasand-mail-relay-renewal`
    const current = spawnSync('crontab', ['-l'], { encoding: 'utf8' })
    if (current.status && !current.stderr.includes('no crontab')) throw new Error('Could not read existing crontab')
    const lines = current.stdout.split(/\r?\n/).filter(item => item && !item.endsWith('# hanasand-mail-relay-renewal'))
    run(['crontab', '-'], { input: [...lines, line, ''].join('\n') })
    console.log('Hourly certificate refresh installed; existing scheduled tasks preserved.')
}
export async function activateInspur() {
    const admin = mailAdmin()
    const call = (endpoint: string, body?: unknown) => api('http://127.0.0.1:8081', admin.user, admin.secret, endpoint, body)
    const response = await fetch('http://127.0.0.1:19261/health', { signal: AbortSignal.timeout(5000) })
    if (!response.ok && response.status !== 503) throw new Error(`Relay health failed: HTTP ${response.status}`)
    const health = await response.json() as any
    if (!['smtpAuthentication', 'relayAuthentication', 'tunnel'].every(key => health.checks?.[key]))
        throw new Error('Private relay authentication must pass before activation')
    const saved = readJson(path.join(ROOT, 'ovh-credentials.json'))
    const values = {
        'queue.route.ovh-relay.type': 'relay', 'queue.route.ovh-relay.address': 'smtp-relay.hanasand.com', 'queue.route.ovh-relay.port': '1587',
        'queue.route.ovh-relay.protocol': 'smtp', 'queue.route.ovh-relay.auth.username': 'inspur-relay', 'queue.route.ovh-relay.auth.secret': saved.relay,
        'queue.route.ovh-relay.tls.implicit': 'false', 'queue.route.ovh-relay.tls.allow-invalid-certs': 'false',
        'queue.strategy.route.0.if': "is_local_domain('*', rcpt_domain)", 'queue.strategy.route.0.then': "'local'", 'queue.strategy.route.1.else': "'ovh-relay'",
        'queue.tls.ovh-relay.starttls': 'require', 'queue.tls.ovh-relay.allow-invalid-certs': 'false', 'queue.tls.ovh-relay.timeout.tls': '10s', 'queue.strategy.tls': "'ovh-relay'",
    }
    const backup = path.join(ROOT, 'route-before.json')
    if (!existsSync(backup)) writeSecret(backup, JSON.stringify(await call('/settings/list?prefix=queue.strategy')))
    await call('/settings', [{ type: 'clear', prefix: 'queue.strategy.route' }, { type: 'clear', prefix: 'queue.strategy.tls' },
        { type: 'insert', assert_empty: false, prefix: null, values: Object.entries(values) }])
    const result = await call('/reload')
    if (result.data?.errors) throw new Error('Relay configuration reload failed')
    console.log('All mailboxes use the authenticated OVH relay for external delivery with required TLS; local delivery is preserved.')
}

export async function setupOvh(image: string) {
    const saved = credentials(); refreshTls()
    const configFile = path.join(ROOT, 'data/etc/config.toml')
    if (!existsSync(configFile)) writeSecret(configFile, `[server.listener.submission]\nbind = "[::]:1587"\nprotocol = "smtp"\n[server.listener.http]\nbind = "[::]:8080"\nprotocol = "http"\n[server]\nhostname = "mail.hanasand.com"\n[storage]\nblob = "rocksdb"\ndata = "rocksdb"\ndirectory = "internal"\nfts = "rocksdb"\nlookup = "rocksdb"\n[store.rocksdb]\ntype = "rocksdb"\npath = "/opt/stalwart/data"\ncompression = "lz4"\n[directory.internal]\ntype = "internal"\nstore = "rocksdb"\n[authentication.fallback-admin]\nuser = "admin"\nsecret = "${saved.admin}"\n[certificate.default]\ncert = "%{file:/run/tls/fullchain.pem}%"\nprivate-key = "%{file:/run/tls/privkey.pem}%"\ndefault = true\n[tracer.stdout]\ntype = "console"\nlevel = "info"\nansi = false\nenable = true\n`)
    const network = 'hanasand-mail-relay'
    if (spawnSync('docker', ['network', 'inspect', network], { stdio: 'ignore' }).status !== 0) run(['docker', 'network', 'create', network], { ignore: true })
    start('hanasand-mail-relay-ovh', STALWART_IMAGE, network, [`${ROOT}/data:/opt/stalwart`, `${ROOT}/tls:/run/tls:ro`],
        ['127.0.0.1:2687:1587', '127.0.0.1:18081:8080'], ['smtp-relay.hanasand.com'])
    const base = 'http://127.0.0.1:18081', admin = { user: 'admin', secret: saved.admin }
    for (let i = 0; i < 30; i++) {
        try { await api(base, admin.user, admin.secret, '/principal?limit=1'); break }
        catch (error) { if (i === 29) throw error; await delay(1000) }
    }
    await ensurePrincipal(base, admin, { type: 'domain', name: 'hanasand.com' })
    await ensurePrincipal(base, admin, { type: 'individual', name: 'inspur-relay', secrets: [saved.relay], emails: ['noreply@hanasand.com'], roles: [], enabledPermissions: ['authenticate', 'email-send'] })
    await ensurePrincipal(base, admin, { type: 'individual', name: 'relay-health', secrets: [saved.health], roles: [], enabledPermissions: ['authenticate', 'message-queue-list', 'message-queue-get'] })
    await api(base, 'relay-health', saved.health, '/queue/messages?limit=1')
    const settings = { site: 'ovh', incoming: { host: '192.99.32.185' }, smtp: { host: 'smtp-relay.hanasand.com', port: 1587, serverName: 'smtp-relay.hanasand.com', username: 'inspur-relay', password: saved.relay, sender: 'sales@hanasand.com' },
        queue: { url: 'http://hanasand-mail-relay-ovh:8080', username: 'relay-health', password: saved.health } }
    writeSecret(path.join(ROOT, 'health/health.json'), JSON.stringify(settings))
    start('hanasand-mail-relay-ovh-health', image, network, [`${ROOT}/health:/run/config:ro`], ['127.0.0.1:19262:8080'])
    console.log('OVH private SMTP relay and readiness service installed.')
}

export async function setupInspur(image: string, apiContainer: string) {
    const saved = credentials(), relay = readJson(path.join(ROOT, 'ovh-credentials.json')), admin = mailAdmin(), base = 'http://127.0.0.1:8081'
    await ensurePrincipal(base, admin, { type: 'individual', name: 'relay-health', secrets: [saved.health], roles: [], enabledPermissions: ['authenticate', 'message-queue-list', 'message-queue-get'] })
    await api(base, 'relay-health', saved.health, '/queue/messages?limit=1')
    const javascript = 'import {systemSenderAccess} from "./src/utils/mail/system.ts";console.log(JSON.stringify(systemSenderAccess()));process.exit(0);'
    const sender = JSON.parse(execFileSync('docker', ['exec', apiContainer, 'bun', '-e', javascript], { encoding: 'utf8' }))
    const settings = { site: 'inspur', smtp: { host: 'stalwart', port: 587, serverName: 'mail.hanasand.com', ...sender },
        relay: { host: '127.0.0.1', port: 1587, serverName: 'smtp-relay.hanasand.com', username: 'inspur-relay', password: relay.relay },
        queue: { url: 'http://stalwart:8080', username: 'relay-health', password: saved.health } }
    writeSecret(path.join(ROOT, 'health/health.json'), JSON.stringify(settings))
    start('hanasand-mail-relay-inspur', image, 'hanasand_hanasandnet', [`${ROOT}/health:/run/config:ro`, `${ROOT}/ssh:/run/ssh:ro`], ['127.0.0.1:19261:8080'], ['mail-relay-inspur', 'smtp-relay.hanasand.com'])
    console.log('Inspur connector and readiness service installed. Routing is not changed until activation.')
}

export async function configureGateway(site: 'ovh' | 'inspur') {
    if (site === 'inspur') {
        const admin = mailAdmin()
        const info = JSON.parse(execFileSync('docker', ['inspect', 'hanasand-mail-relay-inspur'], { encoding: 'utf8' }))[0]
        const address = info.NetworkSettings.Networks.hanasand_hanasandnet.IPAddress
        await api('http://127.0.0.1:8081', admin.user, admin.secret, '/settings', [{ type: 'insert', assert_empty: false, prefix: null, values: [['server.listener.smtp.proxy.trusted-networks', `${address}/32`]] }])
        run(['docker', 'restart', 'hanasand_mail'], { ignore: true })
        console.log('Incoming SMTP trusts PROXY headers only from the private connector.')
        return
    }
    const keysFile = path.join(homedir(), '.ssh/authorized_keys')
    const lines = readFileSync(keysFile, 'utf8').split(/(?<=\n)/)
    const matching = lines.map((line, i) => [i, line]).filter(([, line]) => line.includes('permitopen="127.0.0.1:2687"') && line.includes('permitopen="127.0.0.1:19262"'))
    if (matching.length !== 1) throw new Error('Expected exactly one restricted mail relay SSH key')
    const index = matching[0][0] as number
    if (!lines[index].includes('permitlisten="127.0.0.1:2625"')) {
        writeSecret(path.join(ROOT, 'authorized-keys-before-inbound'), readFileSync(keysFile, 'utf8'))
        lines[index] = `permitlisten="127.0.0.1:2625",${lines[index]}`
        writeSecret(keysFile, lines.join(''))
    }
    const saved = credentials()
    await api('http://127.0.0.1:18081', 'admin', saved.admin, '/settings', [
        { type: 'clear', prefix: 'session.auth.match-sender' }, { type: 'clear', prefix: 'session.auth.must-match-sender' },
        { type: 'insert', assert_empty: false, prefix: null, values: [['session.auth.must-match-sender.0.if', "authenticated_as == 'inspur-relay' && is_tls && (sender_domain == 'hanasand.com' || sender == '')"],
            ['session.auth.must-match-sender.0.then', 'false'], ['session.auth.must-match-sender.1.else', 'true']] },
    ])
    const result = await api('http://127.0.0.1:18081', 'admin', saved.admin, '/reload')
    if (result.data?.errors) throw new Error('Relay configuration reload failed')
    const configFile = path.join(ROOT, 'gateway.cfg')
    writeSecret(configFile, readFileSync(path.join(process.cwd(), 'services/mail-relay/gateway.cfg'), 'utf8'))
    chmodSync(configFile, 0o644)
    const image = 'haproxy@sha256:6343ce34a132a5dceaa24767d739df2bd519f8f7c1079ae39e4821334e8eb42e'
    const flags = ['--network', 'host', '--user', '0:0', '--cap-drop', 'ALL', '--cap-add', 'NET_BIND_SERVICE', '--cap-add', 'SETUID', '--cap-add', 'SETGID', '--security-opt', 'no-new-privileges:true',
        '--read-only', '--memory', '128m', '--cpus', '1', '-v', `${configFile}:/usr/local/etc/haproxy/haproxy.cfg:ro`]
    run(['docker', 'run', '--rm', ...flags, image, 'haproxy', '-c', '-f', '/usr/local/etc/haproxy/haproxy.cfg'], { ignore: true })
    const name = 'hanasand-mail-gateway-ovh'
    if (spawnSync('docker', ['inspect', name], { stdio: 'ignore' }).status === 0) run(['docker', 'rm', '-f', name], { ignore: true })
    run(['docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped', '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3', ...flags, image], { ignore: true })
    run(['sudo', '-n', 'ufw', 'allow', 'proto', 'tcp', 'from', 'any', 'to', '192.99.32.185', 'port', '25', 'comment', 'Hanasand incoming mail gateway'])
    console.log('OVH public SMTP gateway installed; mailboxes and recipient validation remain on Inspur.')
}

if (import.meta.main) {
    const [site, ...args] = Bun.argv.slice(2)
    if (!['ovh', 'inspur'].includes(site)) throw new Error('Choose site ovh or inspur')
    mkdirSync(ROOT, { recursive: true, mode: 0o700 })
    const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
    if (args.includes('--configure-gateway')) await configureGateway(site as 'ovh' | 'inspur')
    else if (option('--renewal-revision') && site === 'ovh') installCertificateRefresh(option('--renewal-revision')!)
    else if (args.includes('--refresh-tls') && site === 'ovh') await refreshOvhCertificate()
    else if (args.includes('--activate') && site === 'inspur') await activateInspur()
    else if (option('--image')) {
        if (site === 'ovh') await setupOvh(option('--image')!)
        else if (option('--api-container')) await setupInspur(option('--image')!, option('--api-container')!)
        else throw new Error('Inspur setup requires --api-container naming an active API container')
    } else throw new Error('Choose --image, OVH --refresh-tls, or Inspur --activate')
}
