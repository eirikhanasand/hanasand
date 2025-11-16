SELECT 
    u.id AS user_id,
    r.id AS id,
    r.name AS name,
    r.priority AS priority
FROM users u
LEFT JOIN LATERAL (
    SELECT roles.id, roles.name, roles.priority
    FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = u.id
    ORDER BY roles.priority ASC
    LIMIT 1
) r ON TRUE
WHERE u.id = $1::TEXT;
