#!/usr/bin/env bun
/** Add local service routing; --activate switches only website/API virtual hosts. */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export function upstream(name: string, ports: number[]) {
    return `upstream ${name} {\n${ports.map((port, i) => `    server 127.0.0.1:${port} max_fails=1 fail_timeout=3s${i ? ' backup' : ''};\n`).join('')}    keepalive 32;\n}\n`
}

export function build(site: string, root: string, activate: boolean, scriptRoot = import.meta.dir) {
    if (!['inspur', 'ovh'].includes(site)) throw new Error('Site must be inspur or ovh')
    const primary = site === 'inspur'
    const ports = primary ? { frontend: [13000], api: [18080], auth: [18090] } : { frontend: [19300], api: [19080], auth: [19090] }
    let config = Object.entries(ports).map(([name, values]) => upstream(`hanasand_recovery_${name}`, values)).join('')
    const localPort = primary ? 28082 : 19081
    config += `
server {
    listen 127.0.0.1:${localPort};
    server_name api.hanasand.com;
    location ^~ /api/auth/ {
        proxy_pass http://hanasand_recovery_auth;
        include snippets/proxy-headers.conf;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
    location = /api/user {
        proxy_pass http://hanasand_recovery_auth;
        include snippets/proxy-headers.conf;
    }
    location / {
        proxy_pass http://hanasand_recovery_api;
        include snippets/proxy-headers.conf;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
}
`
    const changes = new Map<string, string>([[path.join(root, 'conf.d/recovery-upstreams.conf'), config]])
    if (activate) {
        const main = path.join(root, 'conf.d/default.conf')
        const source = readFileSync(main, 'utf8')
        const blocks = source.split(/(?<=\n})\s*(?=server \{)/)
        const touched = new Set<string>()
        for (let i = 0; i < blocks.length; i++) {
            let block = blocks[i]
            if (!/\blisten\s+(?:127\.0\.0\.1:)?(?:443|8443)\s+ssl\b/.test(block)) continue
            if (/server_name\s+hanasand\.com(?:\s+www\.hanasand\.com)?;/.test(block)) {
                block = block.replace(/proxy_pass http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3100|3200|3300);/g, 'proxy_pass http://hanasand_recovery_frontend;')
                    .replace(/proxy_pass http:\/\/(?:localhost|127\.0\.0\.1):8080;/g, 'proxy_pass http://hanasand_recovery_api;')
                touched.add('frontend')
            }
            if (/server_name\s+api\.hanasand\.com;/.test(block)) {
                block = block.replace(/proxy_pass http:\/\/(?:localhost|127\.0\.0\.1):8080;/g, 'proxy_pass http://hanasand_recovery_api;')
                if (!block.includes('include snippets/auth-routes.conf;')) block = block.replace('server_name api.hanasand.com;', 'server_name api.hanasand.com;\n    include snippets/auth-routes.conf;')
                block = block.replace('proxy_pass http://127.0.0.1:19901/status;', 'proxy_pass http://127.0.0.1:19901/public-status;')
                if (!block.includes('location = /api/recovery/status')) block = block.replace('server_name api.hanasand.com;', 'server_name api.hanasand.com;\n    location = /api/recovery/status { proxy_pass http://127.0.0.1:19901/public-status; proxy_connect_timeout 2s; proxy_read_timeout 3s; }')
                touched.add('api')
            }
            blocks[i] = block
        }
        if (touched.size !== 2 || !touched.has('frontend') || !touched.has('api')) throw new Error('Could not identify both public virtual hosts')
        changes.set(main, blocks.join('\n\n'))
        changes.set(path.join(root, 'conf.d/auth-upstream.conf'), upstream('hanasand_auth', ports.auth))
        for (const name of ['auth-routes', 'auth-proxy']) {
            const target = path.join(root, `snippets/${name}.conf`)
            if (!existsSync(target)) changes.set(target, readFileSync(path.join(scriptRoot, `nginx-${name}.conf`), 'utf8'))
        }
    }
    return changes
}

export function install(site: string, root: string, activate: boolean) {
    const changes = build(site, root, activate)
    const backup = path.join(root, `recovery-backup-${Math.floor(Date.now() / 1000)}`)
    mkdirSync(backup)
    const previous = new Map<string, string | null>()
    for (const [file, content] of changes) {
        previous.set(file, existsSync(file) ? readFileSync(file, 'utf8') : null)
        if (existsSync(file)) copyFileSync(file, path.join(backup, path.basename(file)))
        writeFileSync(file, content)
    }
    const run = (args: string[], required = true) => {
        const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit' })
        if (required && result.status !== 0) throw new Error(`${args.join(' ')} failed`)
    }
    try {
        run(['docker', 'exec', 'openresty', 'nginx', '-t'])
        run(['docker', 'exec', 'openresty', 'nginx', '-s', 'reload'])
    } catch (error) {
        for (const [file, content] of previous) {
            if (content === null) { if (existsSync(file)) unlinkSync(file) }
            else writeFileSync(file, content)
        }
        run(['docker', 'exec', 'openresty', 'nginx', '-s', 'reload'], false)
        throw error
    }
    console.log('Proxy configuration validated and reloaded; rollback files:', backup)
}

if (import.meta.main) {
    const [site, root, ...flags] = Bun.argv.slice(2)
    if (!site || !root || flags.some(flag => flag !== '--activate')) throw new Error('Usage: install-nginx.ts <inspur|ovh> <config-root> [--activate]')
    install(site, root, flags.includes('--activate'))
}
