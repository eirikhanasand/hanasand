SELECT
    v.name,
    v.owner,
    v.created_by,
    v.access_users,
    COALESCE(d.status, 'unknown') AS status,
    'virtual-machine' AS type,
    COALESCE(d.architecture, '') AS architecture,
    COALESCE(d.created, '') AS created,
    COALESCE(d.last_used, '') AS last_used,
    COALESCE(d.config_image_description, '') AS config_image_description,
    COALESCE(d.config_image_os, '') AS config_image_os,
    COALESCE(d.config_image_version, '') AS config_image_version,
    COALESCE(d.limits_cpu, '') AS limits_cpu,
    COALESCE(d.limits_memory, '') AS limits_memory,
    COALESCE(d.device_eth0_ipv4_address, '') AS device_eth0_ipv4_address,
    d.last_checked
FROM vms v
LEFT JOIN vm_details d ON d.name = v.name
WHERE v.name = $1
