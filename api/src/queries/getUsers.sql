SELECT 
    u.id, 
    u.name, 
    u.avatar,
    r.id AS highest_role_id,
    r.name AS highest_role_name,
    r.priority AS highest_role_priority
FROM users u
LEFT JOIN LATERAL (
    SELECT 
      roles.id, 
      roles.name, 
      roles.priority
    FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = u.id
    ORDER BY roles.priority ASC
    LIMIT 1
) r ON TRUE;
