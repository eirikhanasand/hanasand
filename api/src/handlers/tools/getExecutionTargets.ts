import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { buildAgentTarget } from '#utils/vms/buildAgentTarget.ts'
import { agentTargetSelect } from '#utils/vms/agentTargetQuery.ts'

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

export default async function getExecutionTargets(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { valid: isAdmin } = await hasRole(req, res, 'system_admin')

    try {
        const result = isAdmin
            ? await run(`
                ${agentTargetSelect}
                ORDER BY v.name ASC
            `)
            : await run(`
                ${agentTargetSelect}
                WHERE v.owner = $1
                   OR v.created_by = $1
                   OR v.access_users ? $1
                ORDER BY v.name ASC
            `, [id])

        const vmTargets = result.rows.map((row) => {
            const target = buildAgentTarget({
                vm: row as VMRow,
                currentUserId: id,
                canManage: isAdmin,
            })

            return {
                id: `vm:${target.id}`,
                label: target.name,
                kind: 'vm' as const,
                transport: 'hanasand_vm_api' as const,
                summary: `${target.type} owned by ${target.owner}`,
                readiness: target.capabilities.canConnect ? 'ready' as const : 'partial' as const,
                trustBoundary: 'remote' as const,
                target,
            }
        })

        const localTarget: AgentExecutionTarget = {
            id: 'local:workspace',
            label: 'Local workspace',
            kind: 'local_workspace',
            transport: 'local_process',
            summary: 'Current repo/share execution on the same machine as the Hanasand agent runtime.',
            readiness: 'ready',
            trustBoundary: 'local',
            target: {
                kind: 'local_workspace',
                supportedWorkspaceKinds: ['share', 'repo'],
                supportedOperations: [
                    'scaffold_nextjs_docker_app',
                    'scaffold_fastify_postgres_app',
                    'compose_up',
                    'compose_logs',
                    'compose_down',
                    'http_request',
                ],
                missingCapabilities: [
                    'Remote VM command execution is not yet routed through this target.',
                ],
            },
        }

        return res.send({
            defaultTargetId: localTarget.id,
            targets: [localTarget, ...vmTargets],
            notes: [
                'Local workspace execution remains the default execution path today.',
                'VM targets now expose narrow remote write actions for authorized-key synchronization and VM-local HTTP requests, but they still do not expose shell or file-write APIs.',
                'Use `/api/vm/:id/agent-target` or `/api/vms/agent/targets` for VM-specific contract details.',
            ],
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Unable to load execution targets.' })
    }
}
