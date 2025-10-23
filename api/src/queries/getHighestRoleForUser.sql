SELECT 
    u.id, 
    r.id AS highest_role_id,
    r.priority AS highest_role_priority
FROM users u
LEFT JOIN LATERAL (
    SELECT roles.id, roles.priority
    FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = u.id
    ORDER BY roles.priority ASC
    LIMIT 1
) r ON TRUE
WHERE u.id = $1::TEXT;
