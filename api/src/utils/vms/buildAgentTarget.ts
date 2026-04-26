import config from '#constants'

type VMRow = {
    name: string
    owner: string
    created_by: string
    access_users: string[] | null
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_image_description: string
    limits_cpu: string
    limits_memory: string
    device_eth0_ipv4_address: string
    last_checked: string
}

type AgentTargetOptions = {
    vm: VMRow
    currentUserId: string
    canManage: boolean
}

export function buildAgentTarget({ vm, currentUserId, canManage }: AgentTargetOptions): AgentVmTarget {
    const accessUsers = Array.isArray(vm.access_users) ? vm.access_users : []
    const canConnect = vm.status.toLowerCase() !== 'stopped'
    const supportedActions: Array<'start' | 'stop' | 'restart'> = canManage ? ['start', 'stop', 'restart'] : []
    const canAccess =
        canManage
        || vm.owner === currentUserId
        || vm.created_by === currentUserId
        || accessUsers.includes(currentUserId)
    const baseApiPath = `/api/vm/${encodeURIComponent(vm.name)}`
    const vmIp = vm.device_eth0_ipv4_address || ''

    return {
        id: vm.name,
        name: vm.name,
        owner: vm.owner,
        createdBy: vm.created_by,
        accessUsers,
        status: vm.status,
        type: vm.type,
        architecture: vm.architecture,
        imageDescription: vm.config_image_description,
        createdAt: vm.created,
        lastUsedAt: vm.last_used,
        lastCheckedAt: vm.last_checked,
        network: {
            ipv4: vmIp,
            sshHost: vmIp || null,
            sshUser: vm.name,
        },
        resources: {
            cpu: vm.limits_cpu,
            memory: vm.limits_memory,
        },
        capabilities: {
            canView: true,
            canConnect,
            canManage,
            canSyncAuthorizedKeys: true,
            canExecuteRemoteCommands: false,
            canWriteRemoteFiles: false,
            supportedActions,
            supportedConnectionMethods: ['ssh'],
            missingCapabilities: [
                {
                    key: 'remote_command_execution',
                    reason: 'No API endpoint exists yet for shell command execution on a VM target.',
                },
                {
                    key: 'remote_file_write',
                    reason: 'No API endpoint exists yet for pushing or patching files on a VM target.',
                },
                {
                    key: 'remote_terminal_stream',
                    reason: 'There is no websocket or session API for interactive shell streaming yet.',
                },
                {
                    key: 'remote_repo_sync',
                    reason: 'Repository clone/sync flows are still local-only and not VM-target aware.',
                },
            ],
        },
        endpoints: {
            summary: baseApiPath,
            details: `/api/vm/details/${encodeURIComponent(vm.name)}`,
            connection: `${baseApiPath}/connection`,
            syncAuthorizedKeys: `${baseApiPath}/agent-target/sync-access`,
            request: `${baseApiPath}/request`,
            actions: supportedActions.reduce<Record<string, string>>((acc, action) => {
                acc[action] = `${baseApiPath}/${action}`
                return acc
            }, {}),
        },
        suggestedFlow: {
            selection: canAccess ? 'vm' : 'unavailable',
            connect: canConnect ? `ssh ${vm.name}@${vmIp || '<pending-ip>'}` : null,
            prerequisites: [
                'Valid authenticated Hanasand API session',
                'At least one SSH certificate on the user profile',
                'Reachable VM IPv4 address from the operator environment',
            ],
            notes: [
                'Use the connection endpoint before SSH so profile certificates are synchronized to the VM.',
                'Use the sync-access endpoint when you need an explicit, auditable authorized-key refresh without opening an SSH session yet.',
                'Use the request endpoint for a narrow VM-local HTTP bridge to localhost, loopback, or the VM IPv4 address without opening raw shell access.',
                canManage
                    ? 'Start/stop/restart can be invoked through the listed action endpoints.'
                    : 'Power actions are admin-only even when read access is available.',
                `Internal VM control requests are forwarded through ${config.internal_api}.`,
            ],
        },
    }
}
