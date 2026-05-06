import config from '#constants'
import run from '#db'

type AlwaysRunningRow = {
    name: string
}

export default async function ensureAlwaysRunningVms() {
    if (!config.internal_api || !config.vm_api_token) {
        return
    }

    const result = await run(`
        SELECT v.name
        FROM vms v
        LEFT JOIN vm_details d ON LOWER(d.name) = LOWER(v.name)
        WHERE v.always_running_enabled IS TRUE
          AND LOWER(COALESCE(d.status, 'unknown')) IN ('stopped', 'unknown', 'error')
    `)

    await Promise.all(result.rows.map(row => startVm(row as AlwaysRunningRow)))
}

async function startVm(vm: AlwaysRunningRow) {
    const response = await fetch(`${config.internal_api}/vm/${encodeURIComponent(vm.name)}/start`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
            'User-Agent': 'hanasand_internal',
        },
    })

    if (!response.ok) {
        throw new Error(`Unable to keep ${vm.name} running: ${response.status}`)
    }
}
