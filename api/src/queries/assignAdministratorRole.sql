WITH ins1 AS (
    INSERT INTO user_roles (user_id, role_id, assigned_by)
    VALUES ($1::TEXT, 'administrator', 'administrator')
    RETURNING user_id
)
INSERT INTO root (id, created)
SELECT user_id, TRUE FROM ins1
ON CONFLICT (id) DO UPDATE SET created = TRUE;
