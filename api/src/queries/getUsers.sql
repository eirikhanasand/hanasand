SELECT 
    u.id, 
    u.name, 
    u.avatar,
    u.active,
    u.deactivated_at,
    u.deactivated_by,
    r.id AS highest_role_id,
    r.name AS highest_role_name,
    r.priority AS highest_role_priority,
    org.organization_names AS organization,
    org.organization_ids
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
) r ON TRUE
LEFT JOIN LATERAL (
    SELECT
      string_agg(DISTINCT COALESCE(NULLIF(organizations.name, ''), organization_members.organization_id), ', ' ORDER BY COALESCE(NULLIF(organizations.name, ''), organization_members.organization_id)) AS organization_names,
      string_agg(DISTINCT organization_members.organization_id, ', ' ORDER BY organization_members.organization_id) AS organization_ids
    FROM organization_members
    LEFT JOIN organizations ON organizations.id = organization_members.organization_id
    WHERE organization_members.user_id = u.id
      AND organization_members.status = 'active'
) org ON TRUE
ORDER BY u.name ASC, u.id ASC;
