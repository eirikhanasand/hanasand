SELECT latest.*
FROM vms v
JOIN LATERAL (
    SELECT * FROM vm_metrics m WHERE m.name = v.name
    ORDER BY m.created_at DESC LIMIT 1
) latest ON TRUE
ORDER BY latest.name;
