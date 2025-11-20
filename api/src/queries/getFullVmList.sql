SELECT 
    v.*, 
    d.status, d.type, d.architecture,
    d.created, d.last_used,
    d.config_image_description,
    d.limits_cpu, d.limits_memory,
    d.device_eth0_ipv4_address,
    d.last_checked
FROM vms v
LEFT JOIN vm_details d ON d.name = v.name;
