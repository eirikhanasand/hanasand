import run from '#db'

export const contentOrganizationSchema = `
ALTER TABLE share ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_share_organization ON share(organization_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_organization ON thoughts(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_organization ON notes(organization_id);
CREATE TABLE IF NOT EXISTS article_ownership (
    id TEXT PRIMARY KEY,
    owner_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
    organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
    CHECK (num_nonnulls(owner_id, organization_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_articles_organization ON article_ownership(organization_id);
CREATE OR REPLACE FUNCTION content_organization_access(org_id TEXT, viewer_id TEXT, editing BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
        WHERE m.organization_id = org_id AND m.user_id = viewer_id
          AND m.status = 'active' AND o.status = 'active'
          AND (NOT editing OR m.role IN ('owner', 'admin', 'editor'))
    )
$$;
`

export default async function ensureContentOrganizationSchema() {
    await run(contentOrganizationSchema)
}
