SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = $1::TEXT
      AND ur.role_id = $2::TEXT
) AS has_role;
