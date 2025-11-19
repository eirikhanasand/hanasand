import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import config from '#constants'

const requiredFields: (keyof PostVmDetails)[] = [
    "name", "status", "type", "architecture", "created", "last_used",
    "config_architecture", "config_image_architecture", "config_image_description",
    "config_image_label", "config_image_os", "config_image_release", "config_image_serial",
    "config_image_type", "config_image_version", "limits_cpu", "limits_memory",
    "volatile_base_image", "volatile_cloud_init_instance_id", "volatile_eth0_hwaddr",
    "volatile_last_state_power", "volatile_uuid",
    "volatile_uuid_generation", "volatile_vsock_id",
    "device_eth0_ipv4_address", "device_eth0_name", "device_eth0_network",
    "device_eth0_type", "ephemeral", "stateful", "description", "profiles"
]

export default async function postVMDetails(req: FastifyRequest, res: FastifyReply) {
    const tokenHeader = req.headers['authorization'] || ''
    const token = tokenHeader.split(' ')[1] ?? ''
    const { 
        name, status, type, architecture, created, last_used,
        config_architecture, config_image_architecture, config_image_description,
        config_image_label, config_image_os, config_image_release, config_image_serial,
        config_image_type, config_image_version, limits_cpu, limits_memory,
        volatile_base_image, volatile_cloud_init_instance_id, volatile_eth0_hwaddr,
        volatile_last_state_power, volatile_uuid,
        volatile_uuid_generation, volatile_vsock_id,
        device_eth0_ipv4_address, device_eth0_name, device_eth0_network,
        device_eth0_type, ephemeral, stateful, description, profiles 
    } = req.body as PostVmDetails ?? {}

    if (!token || Array.isArray(token) || token !== config.vm_api_token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const missingFields = requiredFields.filter(field => (
        req.body as PostVmDetails)[field] === undefined 
        || (req.body as PostVmDetails)[field] === null
    )
    if (missingFields.length > 0) {
        return res.status(400).send({ error: `Missing required fields: ${missingFields.join(", ")}` });
    }

    try {
        const nameResult = await run('SELECT id FROM vms WHERE name = $1', [name])
        const vm_id = nameResult.rows[0].id
        if (!vm_id) {
            return res.status(404).send({ error: 'VM does not exist.' })
        }

        const result = await run(
            `INSERT INTO vms (
                vm_id, name, status, type, architecture, created, last_used,
                config_architecture, config_image_architecture, config_image_description,
                config_image_label, config_image_os, config_image_release, config_image_serial,
                config_image_type, config_image_version, limits_cpu, limits_memory,
                volatile_base_image, volatile_cloud_init_instance_id, volatile_eth0_hwaddr,
                volatile_last_state_power, volatile_uuid,
                volatile_uuid_generation, volatile_vsock_id,
                device_eth0_ipv4_address, device_eth0_name, device_eth0_network,
                device_eth0_type, ephemeral, stateful, description, profiles
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, 
                $8, $9, $10, 
                $11, $12, $13, $14, 
                $15, $16, $17, $18, 
                $19, $20, $21, 
                $22, $23, 
                $24, $25, 
                $26, $27, $28, 
                $29, $30, $31, $32, $33
                $34
            ) RETURNING *`,
            [
                vm_id, name, status, type, architecture, created, last_used,
                config_architecture, config_image_architecture, config_image_description,
                config_image_label, config_image_os, config_image_release, config_image_serial,
                config_image_type, config_image_version, limits_cpu, limits_memory,
                volatile_base_image, volatile_cloud_init_instance_id, volatile_eth0_hwaddr,
                volatile_last_state_power, volatile_uuid,
                volatile_uuid_generation, volatile_vsock_id,
                device_eth0_ipv4_address, device_eth0_name, device_eth0_network,
                device_eth0_type, ephemeral, stateful, description, JSON.stringify(profiles),
                new Date().toISOString()
            ]
        )

        return res.status(201).send(result.rows[0])
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: "Internal server error" })
    }
}
