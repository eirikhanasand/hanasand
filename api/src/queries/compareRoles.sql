SELECT
    CASE 
        WHEN COALESCE(MAX(r.priority), 10000) < t.priority THEN true
        ELSE false
    END AS can_assign
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN roles t ON t.id = :target_role_id
WHERE ur.user_id = :current_user_id;
