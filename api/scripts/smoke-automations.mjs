const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
const suffix = `${Date.now()}${Math.random().toString(16).slice(2)}`
const userId = `automation_smoke_${suffix}`
const password = `Smoke-${suffix}-AA!!22bb`
let auth
let automationId

async function request(path, init = {}, auth) {
    const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(auth ? { id: auth.id, Authorization: `Bearer ${auth.token}` } : {}),
            ...(init.headers || {}),
        },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(`${init.method || 'GET'} ${path} failed with HTTP ${response.status}: ${body.error || JSON.stringify(body)}`)
    }
    const refreshed = response.headers.get('x-access-token')
    if (auth && refreshed) auth.token = refreshed
    return body
}

async function main() {
    const created = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id: userId, name: 'Automation Smoke', password }),
    })
    auth = { id: created.id || userId, token: created.token }
    if (!auth.token) {
        const login = await request(`/auth/login/${encodeURIComponent(userId)}`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        })
        auth.token = login.token
    }

    const runAt = new Date(Date.now() + 5_000).toISOString()
    const createdAutomation = await request('/automations', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Smoke echo',
            prompt: 'server-side echo result',
            scheduleKind: 'once',
            runAt,
            status: 'active',
            actionType: 'echo',
            timezone: 'Europe/Oslo',
            modelName: null,
            notifyOn: 'always',
        }),
    }, auth)
    automationId = createdAutomation.automation.id

    let details
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
        details = await request(`/automations/${automationId}`, {}, auth)
        if (details.automation.timezone !== 'Europe/Oslo' || details.automation.notifyOn !== 'always') {
            throw new Error(`Automation metadata was not persisted: ${JSON.stringify(details.automation, null, 2)}`)
        }
        const completed = details.runs.find(run => run.status === 'completed')
        if (completed?.result?.includes('server-side echo result')) {
            console.log(JSON.stringify({
                ok: true,
                automationId,
                runId: completed.id,
                result: completed.result,
                observedAfterClientWait: true,
            }, null, 2))
            return
        }
        await new Promise(resolve => setTimeout(resolve, 3_000))
    }

    throw new Error(`Automation did not complete in time. Last state: ${JSON.stringify(details, null, 2)}`)
}

async function cleanup(auth, automationId) {
    if (!auth?.token) return
    if (automationId) {
        await request(`/automations/${automationId}`, { method: 'DELETE' }, auth).catch(error => {
            console.warn(`Automation cleanup failed: ${error.message}`)
        })
    }
    await request('/user/self', { method: 'DELETE' }, auth).catch(error => {
        console.warn(`Smoke user cleanup failed: ${error.message}`)
    })
}

main()
    .finally(() => cleanup(auth, automationId))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
