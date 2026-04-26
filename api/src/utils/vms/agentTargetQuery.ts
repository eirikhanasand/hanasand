export const agentTargetSelect = `
    SELECT
        v.name,
        v.owner,
        v.created_by,
        v.access_users,
        COALESCE(d.status, 'unknown') AS status,
        COALESCE(d.type, 'virtual-machine') AS type,
        COALESCE(d.architecture, 'unknown') AS architecture,
        COALESCE(d.created, '') AS created,
        COALESCE(d.last_used, '') AS last_used,
        COALESCE(d.config_image_description, '') AS config_image_description,
        COALESCE(d.limits_cpu, '') AS limits_cpu,
        COALESCE(d.limits_memory, '') AS limits_memory,
        COALESCE(d.device_eth0_ipv4_address, '') AS device_eth0_ipv4_address,
        COALESCE(d.last_checked::text, '') AS last_checked
    FROM vms v
    LEFT JOIN vm_details d ON d.name = v.name
`
