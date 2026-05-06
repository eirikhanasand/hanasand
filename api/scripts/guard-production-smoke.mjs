const allow = process.env.ALLOW_PRODUCTION_SMOKE === '1'
const targets = [
    process.env.API_BASE,
    process.env.FRONTEND_BASE,
    process.env.NEXT_PUBLIC_API,
    process.env.MONITOR_API_BASE,
].filter(Boolean)

if (process.env.NODE_ENV === 'production' && !allow) {
    fail('Refusing to run smoke/e2e scripts while NODE_ENV=production. Set ALLOW_PRODUCTION_SMOKE=1 for an intentional production check.')
}

for (const target of targets) {
    if (isProductionTarget(target) && !allow) {
        fail(`Refusing to run smoke/e2e scripts against production target ${target}. Set ALLOW_PRODUCTION_SMOKE=1 for an intentional production check.`)
    }
}

function isProductionTarget(value) {
    try {
        const url = new URL(value)
        return !['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    } catch {
        return false
    }
}

function fail(message) {
    console.error(message)
    process.exit(1)
}
