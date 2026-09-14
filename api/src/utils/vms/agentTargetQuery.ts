export const agentTargetSelect = `
    SELECT
        v.name,
        v.owner,
        v.created_by,
        v.organization_id,
        CASE WHEN v.organization_id IS NULL THEN v.access_users ELSE COALESCE((
            SELECT jsonb_agg(m.user_id) FROM organization_members m JOIN organizations o ON o.id = m.organization_id
            WHERE m.organization_id = v.organization_id AND m.status = 'active' AND o.status = 'active'
        ), '[]'::jsonb) END AS access_users,
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
    FROM (SELECT * FROM vms WHERE deleted_at IS NULL) v
    LEFT JOIN vm_details d ON d.name = v.name
`
