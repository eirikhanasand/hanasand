import run from '#db'

export default async function ensureVmOrganizationSchema() {
    await run('ALTER TABLE vms ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT')
    await run('CREATE INDEX IF NOT EXISTS idx_vms_organization ON vms(organization_id)')
    await run(`CREATE OR REPLACE FUNCTION vm_user_has_access(vm_name TEXT, viewer_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM vms v WHERE v.name = vm_name AND CASE
            WHEN v.organization_id IS NOT NULL THEN EXISTS (
                SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
                WHERE m.organization_id = v.organization_id AND m.user_id = viewer_id
                  AND m.status = 'active' AND o.status = 'active'
            )
            ELSE v.owner = viewer_id OR v.created_by = viewer_id OR v.access_users ? viewer_id
        END
    )
$$;
`)
}
