INSERT INTO user_roles (user_id, role_id, assigned_by) 
VALUES ($1::TEXT, $2::TEXT, $3::TEXT)
ON CONFLICT (user_id, role_id) DO NOTHING
RETURNING *;
