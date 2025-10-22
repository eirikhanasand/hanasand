DELETE FROM user_roles
WHERE user_id = $1::TEXT
  AND role_id = $2::TEXT;
