INSERT INTO vms (name, owner, created_by, access_users) 
VALUES ($1, $2, $3, $4) 
ON CONFLICT (id) 
DO NOTHING 
RETURNING *;
