SELECT
    r.id AS id,
    r.name AS name,
    r.priority AS priority,
    ur.assigned_by AS assigned_by,
    ur.assigned_at AS assigned_at
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = $1::TEXT;
