SELECT 
    u.id,
    CASE WHEN $1::boolean THEN u.email ELSE NULL END AS email,
    COALESCE(u.username, u.id) AS username,
    u.name, 
    u.avatar,
    u.active,
    u.created_at,
    u.last_login_at,
    u.deactivated_at,
    u.deactivated_by,
    org.organization_names AS organization,
    org.organization_ids
FROM users u
LEFT JOIN LATERAL (
    SELECT
      string_agg(DISTINCT COALESCE(NULLIF(organizations.name, ''), organization_members.organization_id), ', ' ORDER BY COALESCE(NULLIF(organizations.name, ''), organization_members.organization_id)) AS organization_names,
      string_agg(DISTINCT organization_members.organization_id, ', ' ORDER BY organization_members.organization_id) AS organization_ids
    FROM organization_members
    LEFT JOIN organizations ON organizations.id = organization_members.organization_id
    WHERE organization_members.user_id = u.id
      AND organization_members.status = 'active'
) org ON TRUE
WHERE u.account_type = 'user' AND u.deletion_scheduled_at IS NULL
ORDER BY u.name ASC, u.id ASC;
