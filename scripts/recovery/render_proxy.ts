#!/usr/bin/env node
/** Render HAProxy's native first-healthy-backup policy, not a custom router. */
import { readFile, writeFile } from 'node:fs/promises'

export function render(config) {
    const proxyIndex = config.proxyIndex || 0
    const lines = ['global', '    hard-stop-after 65s', '    log stdout format raw local0', `    stats socket /run/haproxy/admin${proxyIndex}.sock mode 600 level admin`,
        `    stats socket ipv4@127.0.0.1:${19909 + proxyIndex} level admin`, 'defaults', '    log global', '    mode http',
        '    timeout connect 2s', '    timeout client 60s', '    timeout server 60s', '    timeout check 5s', '    retries 1',
        '    option redispatch', '    default-server inter 2s fall 31 rise 31', 'listen stats',
        `    bind 127.0.0.1:${config.statsPort || 19900}`, '    stats enable', '    stats uri /stats']
    for (const service of config.services) {
        if (!service.listenPort) continue
        const tcp = service.id === 'database'
        lines.push(`listen ${service.id}`, `    bind 127.0.0.1:${service.listenPort}`)
        if (service.id === 'api') {
            const proxy = `hanasand-proxy-${proxyIndex + 1}`
            lines.push('    tcp-request connection set-var(sess.correlation) uuid()', '    log-steps accept',
                `    log-format "Connect from %ci:%cp to %fi:%fp (api/HTTP) correlation=%[var(sess.correlation)] proxy=${proxy}"`,
                `    http-request set-header x-hanasand-proxy-connection "%[var(sess.correlation)]|${proxy}|%ci|%cp|%fi|%fp|api"`)
        }
        if (tcp) lines.push('    mode tcp', '    option pgsql-check user hanasand_replica', '    timeout client 1h', '    timeout server 1h')
        else lines.push('    option httpchk', `    http-check send meth GET uri ${service.checkPath || '/ready'} ver HTTP/1.1 hdr Host ${service.host || 'api.hanasand.com'}`, '    http-check expect status 200')
        for (const [index, instance] of service.instances.entries()) {
            if (!instance.address) continue
            let suffix = index ? ' backup' : ''
            if (instance.checkPort) {
                const checkPort = Number(instance.checkPort)
                if (!Number.isInteger(checkPort) || checkPort < 1 || checkPort > 65535) throw new Error('Invalid health check port')
                suffix += ` port ${checkPort}`
            }
            if ((config.maintenanceInstances || []).includes(instance.id)) suffix += ' disabled'
            if (tcp) {
                suffix += ' on-marked-down shutdown-sessions'
                if (!index) suffix += ' on-marked-up shutdown-backup-sessions'
            }
            if (instance.tlsName) suffix += ` ssl verify required ca-file /etc/ssl/certs/ca-certificates.crt sni str(${instance.tlsName}) check-sni ${instance.tlsName}`
            lines.push(`    server ${instance.id} ${instance.address} check${suffix}`)
        }
    }
    return lines.join('\n') + '\n'
}

async function main() {
    const [source, primary, secondary] = process.argv.slice(2)
    const config = JSON.parse(await readFile(source, 'utf8'))
    await writeFile(primary, render(config))
    if (secondary) {
        config.proxyIndex = 1
        config.statsPort = 19902
        await writeFile(secondary, render(config))
    }
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/render_proxy.ts') || process.argv[1]?.endsWith('/render_proxy.ts')) await main()
