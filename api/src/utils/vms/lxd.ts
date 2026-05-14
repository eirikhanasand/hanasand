import http from 'node:http'
import config from '#constants'
import run from '#db'

type LxdInstance = {
    name: string
    status?: string
    type?: string
    architecture?: string
    created_at?: string
    last_used_at?: string
    config?: Record<string, string>
    devices?: Record<string, Record<string, string>>
    expanded_devices?: Record<string, Record<string, string>>
    profiles?: string[]
    description?: string
    ephemeral?: boolean
    stateful?: boolean
}

type LxdState = {
    status?: string
    network?: Record<string, {
        addresses?: Array<{ family?: string, address?: string, scope?: string }>
    }>
}

type LxdOperation = {
    id?: string
    status?: string
    description?: string
    resources?: Record<string, string[]>
}

type LxdOperations = {
    pending?: LxdOperation[]
    running?: LxdOperation[]
}

type LxdResponse<T> = {
    status_code: number
    status: string
    error?: string
    metadata: T
    operation?: string
}

type LxdRequestOptions = { method?: string, body?: unknown }
type LxdRequest = <T>(path: string, options?: LxdRequestOptions) => Promise<LxdResponse<T>>
type VmDetails = ReturnType<typeof mapDetails>
type VmDetailsWriter = (details: VmDetails) => Promise<void>

let lxdRequestImpl: LxdRequest = defaultLxdRequest
let vmDetailsWriter: VmDetailsWriter = writeVmDetailsToDb

export function setLxdRequestForTest(request: LxdRequest) {
    lxdRequestImpl = request
    return () => {
        lxdRequestImpl = defaultLxdRequest
    }
}

export function setVmDetailsWriterForTest(writer: VmDetailsWriter) {
    vmDetailsWriter = writer
    return () => {
        vmDetailsWriter = writeVmDetailsToDb
    }
}

export async function canUseLocalLxd() {
    try {
        await lxdRequest('/1.0')
        return true
    } catch {
        return false
    }
}

export async function provisionLocalLxdInstance(name: string) {
    const existing = await getLocalLxdInstance(name).catch(() => null)
    if (!existing) {
        const response = await lxdRequest<unknown>('/1.0/instances', {
            method: 'POST',
            body: {
                name,
                type: 'container',
                profiles: ['default'],
                config: {
                    'limits.cpu': '1',
                    'limits.memory': '1GiB',
                },
                source: {
                    type: 'image',
                    mode: 'pull',
                    server: config.lxd_image_server,
                    protocol: 'simplestreams',
                    alias: config.lxd_image_alias,
                },
            },
        })
        await waitForOperation(response.operation, 120)
    }

    await setLocalLxdInstanceState(name, 'start', { tolerateAlready: true })
    return refreshLocalLxdDetails(name)
}

export async function getLocalLxdInstance(name: string) {
    const response = await lxdRequest<LxdInstance>(`/1.0/instances/${encodeURIComponent(name)}`)
    return response.metadata
}

export async function setLocalLxdInstanceState(name: string, action: 'start' | 'stop' | 'restart', options: { tolerateAlready?: boolean } = {}) {
    if (action === 'restart') {
        await setLocalLxdInstanceState(name, 'stop', { tolerateAlready: true })
        return setLocalLxdInstanceState(name, 'start', { tolerateAlready: true })
    }

    const instance = await getLocalLxdInstance(name)
    const current = (instance.status || '').toLowerCase()
    if (options.tolerateAlready && ((action === 'start' && current === 'running') || (action === 'stop' && current === 'stopped'))) {
        return refreshLocalLxdDetails(name)
    }

    await waitForInstanceOperations(name, 120)

    const response = await requestStateTransition(name, action)
    await waitForOperation(response.operation, 90)
    return refreshLocalLxdDetails(name)
}

export async function refreshLocalLxdDetails(name: string) {
    const instance = await getLocalLxdInstance(name)
    const state = await lxdRequest<LxdState>(`/1.0/instances/${encodeURIComponent(name)}/state`).then(response => response.metadata).catch(() => null)
    const details = mapDetails(instance, state)
    await upsertVmDetails(details)
    return details
}

async function waitForOperation(operation: string | undefined, timeoutSeconds: number) {
    if (!operation) {
        return
    }

    const id = operation.split('/').pop()
    if (!id) {
        return
    }

    await lxdRequest(`/1.0/operations/${id}/wait?timeout=${timeoutSeconds}`)
}

async function waitForOperationId(id: string | undefined, timeoutSeconds: number) {
    if (!id) {
        return
    }

    await lxdRequest(`/1.0/operations/${encodeURIComponent(id)}/wait?timeout=${timeoutSeconds}`)
}

async function waitForInstanceOperations(name: string, timeoutSeconds: number) {
    const deadline = Date.now() + timeoutSeconds * 1000

    while (Date.now() < deadline) {
        const operations = await lxdRequest<LxdOperations>('/1.0/operations?recursion=1')
            .then(response => response.metadata)
            .catch(() => null)
        const matches = getInstanceOperations(name, operations)
        if (matches.length === 0) {
            return
        }

        for (const operation of matches) {
            const remaining = Math.max(1, Math.ceil((deadline - Date.now()) / 1000))
            await waitForOperationId(operation.id, remaining)
        }
        await sleep(250)
    }

    throw new Error(`Timed out waiting for LXD operations to finish for ${name}.`)
}

function getInstanceOperations(name: string, operations: LxdOperations | null) {
    const allOperations = [
        ...(operations?.pending || []),
        ...(operations?.running || []),
    ]

    return allOperations.filter(operation => {
        const description = (operation.description || '').toLowerCase()
        const isCreateLike = /creat|copy|clon|snapshot|restore/.test(description)
        const instanceResources = operation.resources?.instances || []
        const matchesInstance = instanceResources.some(resource => {
            const resourceName = decodeURIComponent(resource.split('/').pop() || '')
            return resourceName === name
        })

        return matchesInstance && isCreateLike
    })
}

async function requestStateTransition(name: string, action: 'start' | 'stop') {
    const path = `/1.0/instances/${encodeURIComponent(name)}/state`
    const body = {
        action,
        timeout: 60,
        force: true,
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await lxdRequest<unknown>(path, {
                method: 'PUT',
                body,
            })
        } catch (error) {
            if (!isBusyCreateOperation(error) || attempt === 2) {
                throw error
            }

            await waitForInstanceOperations(name, 120)
            await sleep(750)
        }
    }

    throw new Error(`Failed to ${action} ${name}.`)
}

function isBusyCreateOperation(error: unknown) {
    return error instanceof Error && /busy running a ["']?(?:create|copy|clone|snapshot|restore)["']? operation/i.test(error.message)
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function mapDetails(instance: LxdInstance, state: LxdState | null) {
    const configValues = instance.config || {}
    const eth0 = instance.expanded_devices?.eth0 || instance.devices?.eth0 || {}
    const ipv4 = Object.values(state?.network || {})
        .flatMap(network => network.addresses || [])
        .find(address => address.family === 'inet' && address.scope !== 'link')?.address || ''
    const now = new Date().toISOString()

    return {
        name: instance.name,
        status: state?.status || instance.status || 'unknown',
        type: instance.type || 'container',
        architecture: instance.architecture || '',
        created: instance.created_at || '',
        last_used: instance.last_used_at || '',
        config_architecture: configValues['image.architecture'] || instance.architecture || '',
        config_image_architecture: configValues['image.architecture'] || '',
        config_image_description: configValues['image.description'] || config.lxd_image_alias,
        config_image_label: configValues['image.label'] || '',
        config_image_os: configValues['image.os'] || 'ubuntu',
        config_image_release: configValues['image.release'] || config.lxd_image_alias.replace(/^.*?(\d+\.\d+).*$/, '$1'),
        config_image_serial: configValues['image.serial'] || '',
        config_image_type: configValues['image.type'] || instance.type || 'container',
        config_image_version: configValues['image.version'] || configValues['image.release'] || '',
        limits_cpu: configValues['limits.cpu'] || '1',
        limits_memory: configValues['limits.memory'] || '1GiB',
        volatile_base_image: configValues['volatile.base_image'] || '',
        volatile_cloud_init_instance_id: configValues['volatile.cloud-init.instance-id'] || '',
        volatile_eth0_hwaddr: configValues['volatile.eth0.hwaddr'] || '',
        volatile_last_state_power: (state?.status || instance.status || '').toUpperCase(),
        volatile_uuid: configValues['volatile.uuid'] || '',
        volatile_uuid_generation: configValues['volatile.uuid.generation'] || '',
        volatile_vsock_id: configValues['volatile.vsock_id'] || '',
        device_eth0_ipv4_address: ipv4,
        device_eth0_name: eth0.name || 'eth0',
        device_eth0_network: eth0.network || '',
        device_eth0_type: eth0.type || 'nic',
        ephemeral: Boolean(instance.ephemeral),
        stateful: Boolean(instance.stateful),
        description: instance.description || '',
        profiles: instance.profiles || [],
        last_checked: now,
    }
}

async function upsertVmDetails(details: ReturnType<typeof mapDetails>) {
    await vmDetailsWriter(details)
}

async function writeVmDetailsToDb(details: VmDetails) {
    await run(`
        INSERT INTO vm_details (
            name, status, type, architecture, created, last_used,
            config_architecture, config_image_architecture, config_image_description,
            config_image_label, config_image_os, config_image_release, config_image_serial,
            config_image_type, config_image_version, limits_cpu, limits_memory,
            volatile_base_image, volatile_cloud_init_instance_id, volatile_eth0_hwaddr,
            volatile_last_state_power, volatile_uuid,
            volatile_uuid_generation, volatile_vsock_id,
            device_eth0_ipv4_address, device_eth0_name, device_eth0_network,
            device_eth0_type, ephemeral, stateful, description, profiles,
            last_checked
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            $18, $19, $20,
            $21, $22,
            $23, $24,
            $25, $26, $27,
            $28, $29, $30, $31, $32,
            $33
        ) ON CONFLICT (name) DO UPDATE SET
            status = EXCLUDED.status,
            type = EXCLUDED.type,
            architecture = EXCLUDED.architecture,
            created = EXCLUDED.created,
            last_used = EXCLUDED.last_used,
            config_architecture = EXCLUDED.config_architecture,
            config_image_architecture = EXCLUDED.config_image_architecture,
            config_image_description = EXCLUDED.config_image_description,
            config_image_label = EXCLUDED.config_image_label,
            config_image_os = EXCLUDED.config_image_os,
            config_image_release = EXCLUDED.config_image_release,
            config_image_serial = EXCLUDED.config_image_serial,
            config_image_type = EXCLUDED.config_image_type,
            config_image_version = EXCLUDED.config_image_version,
            limits_cpu = EXCLUDED.limits_cpu,
            limits_memory = EXCLUDED.limits_memory,
            volatile_base_image = EXCLUDED.volatile_base_image,
            volatile_cloud_init_instance_id = EXCLUDED.volatile_cloud_init_instance_id,
            volatile_eth0_hwaddr = EXCLUDED.volatile_eth0_hwaddr,
            volatile_last_state_power = EXCLUDED.volatile_last_state_power,
            volatile_uuid = EXCLUDED.volatile_uuid,
            volatile_uuid_generation = EXCLUDED.volatile_uuid_generation,
            volatile_vsock_id = EXCLUDED.volatile_vsock_id,
            device_eth0_ipv4_address = EXCLUDED.device_eth0_ipv4_address,
            device_eth0_name = EXCLUDED.device_eth0_name,
            device_eth0_network = EXCLUDED.device_eth0_network,
            device_eth0_type = EXCLUDED.device_eth0_type,
            ephemeral = EXCLUDED.ephemeral,
            stateful = EXCLUDED.stateful,
            description = EXCLUDED.description,
            profiles = EXCLUDED.profiles,
            last_checked = EXCLUDED.last_checked
    `, [
        details.name, details.status, details.type, details.architecture, details.created, details.last_used,
        details.config_architecture, details.config_image_architecture, details.config_image_description,
        details.config_image_label, details.config_image_os, details.config_image_release, details.config_image_serial,
        details.config_image_type, details.config_image_version, details.limits_cpu, details.limits_memory,
        details.volatile_base_image, details.volatile_cloud_init_instance_id, details.volatile_eth0_hwaddr,
        details.volatile_last_state_power, details.volatile_uuid,
        details.volatile_uuid_generation, details.volatile_vsock_id,
        details.device_eth0_ipv4_address, details.device_eth0_name, details.device_eth0_network,
        details.device_eth0_type, details.ephemeral, details.stateful, details.description, details.profiles,
        details.last_checked,
    ])
}

async function lxdRequest<T>(path: string, options: LxdRequestOptions = {}) {
    return lxdRequestImpl<T>(path, options)
}

async function defaultLxdRequest<T>(path: string, options: LxdRequestOptions = {}) {
    const response = await requestJson<LxdResponse<T>>(path, options)
    if (response.status_code >= 400 || response.error) {
        throw new Error(response.error || `LXD returned ${response.status_code}`)
    }

    return response
}

function requestJson<T>(path: string, options: { method?: string, body?: unknown } = {}) {
    return new Promise<T>((resolve, reject) => {
        const body = options.body ? JSON.stringify(options.body) : undefined
        const request = http.request({
            socketPath: config.lxd_socket_path,
            path,
            method: options.method || 'GET',
            headers: {
                Accept: 'application/json',
                ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
            },
            timeout: 125000,
        }, response => {
            let data = ''
            response.setEncoding('utf8')
            response.on('data', chunk => {
                data += chunk
            })
            response.on('end', () => {
                try {
                    resolve(JSON.parse(data || '{}') as T)
                } catch (error) {
                    reject(error)
                }
            })
        })
        request.on('timeout', () => {
            request.destroy(new Error('LXD request timed out.'))
        })
        request.on('error', reject)
        if (body) {
            request.write(body)
        }
        request.end()
    })
}
