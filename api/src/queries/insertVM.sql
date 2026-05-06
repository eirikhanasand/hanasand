INSERT INTO vms (name, owner, created_by, access_users) 
VALUES ($1, $2, $3, $4) 
ON CONFLICT (name) 
DO UPDATE SET
    owner = EXCLUDED.owner,
    created_by = EXCLUDED.created_by,
    access_users = EXCLUDED.access_users
RETURNING *;
