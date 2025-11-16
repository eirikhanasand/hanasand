SELECT user_id,
        role_id,
        role_name,
        role_priority
FROM (
    SELECT
        u.id AS user_id,
        r.id AS role_id,
        r.name AS role_name,
        r.priority AS role_priority,
        ROW_NUMBER() OVER (
            PARTITION BY u.id
            ORDER BY r.priority ASC
        ) AS rn
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
) ranked
WHERE rn = 1
ORDER BY user_id;
