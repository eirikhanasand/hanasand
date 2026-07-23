import type { SQL } from "bun";
import { normalizeActorLabel } from "../pipeline/mitreActorCatalog.ts";
import { stableId } from "../utils.ts";

export async function persistActorIdentityCatalog(sql: SQL, catalog: any, identities: any[], afterPersist?: (transaction: SQL) => Promise<void>): Promise<void> {
  const identityIds = catalog.identityIds ?? [];
  const currentIdentities = identityIds.map((id: string) => identities.find((identity) => identity.id === id));
  if (new Set(identityIds).size !== identityIds.length || currentIdentities.some((identity: any) => !identity) || currentIdentities.length !== catalog.counts?.totalIdentityCount) {
    throw new Error(`Actor identity catalog ${catalog.id} does not match its current identity set.`);
  }
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO threat_intel.actor_identity_catalogs (
        id, tenant_id, source_id, capture_id, catalog_version, bundle_sha256, retrieved_at, updated_at, record
      ) VALUES (
        ${catalog.id}, ${catalog.tenantId ?? null}, ${catalog.sourceId}, ${catalog.captureId}, ${catalog.catalogVersion},
        ${catalog.bundleSha256}, ${catalog.retrievedAt}, ${catalog.updatedAt}, ${json(catalog)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        source_id = EXCLUDED.source_id,
        capture_id = EXCLUDED.capture_id,
        catalog_version = EXCLUDED.catalog_version,
        bundle_sha256 = EXCLUDED.bundle_sha256,
        retrieved_at = EXCLUDED.retrieved_at,
        updated_at = EXCLUDED.updated_at,
        record = EXCLUDED.record
    `;
    await transaction`
      INSERT INTO threat_intel.actor_identity_catalog_versions (
        id, tenant_id, catalog_id, source_id, capture_id, catalog_version, bundle_sha256, retrieved_at, record
      ) VALUES (
        ${stableId("actor-catalog-version", `${catalog.id}:${catalog.bundleSha256}`)}, ${catalog.tenantId ?? null}, ${catalog.id},
        ${catalog.sourceId}, ${catalog.captureId}, ${catalog.catalogVersion}, ${catalog.bundleSha256}, ${catalog.retrievedAt}, ${json({ ...catalog, identities: currentIdentities })}::text::jsonb
      )
      ON CONFLICT (catalog_id, bundle_sha256) DO NOTHING
    `;
    await transaction`
      UPDATE threat_intel.actor_identities
      SET
        status = 'retired',
        updated_at = ${catalog.updatedAt},
        record = record || jsonb_build_object('status', 'retired', 'retiredAt', ${catalog.updatedAt}::text, 'updatedAt', ${catalog.updatedAt}::text)
      WHERE catalog_id = ${catalog.id}
    `;
    for (const identity of identities) {
      await transaction`
        INSERT INTO threat_intel.actor_identities (
          id, tenant_id, catalog_id, source_id, capture_id, external_id, canonical_name, normalized_name, status,
          apt_number_designation_present, catalog_modified_at, identity_modified_at, updated_at, record
        ) VALUES (
          ${identity.id}, ${identity.tenantId ?? null}, ${identity.catalogId}, ${identity.sourceId}, ${identity.captureId},
          ${identity.externalId}, ${identity.canonicalName}, ${identity.normalizedCanonicalName}, ${identity.status},
          ${identity.aptNumberDesignationPresent}, ${identity.catalogModifiedAt}, ${identity.modifiedAt}, ${identity.updatedAt}, ${json(identity)}::text::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          source_id = EXCLUDED.source_id,
          capture_id = EXCLUDED.capture_id,
          external_id = EXCLUDED.external_id,
          canonical_name = EXCLUDED.canonical_name,
          normalized_name = EXCLUDED.normalized_name,
          status = EXCLUDED.status,
          apt_number_designation_present = EXCLUDED.apt_number_designation_present,
          catalog_modified_at = EXCLUDED.catalog_modified_at,
          identity_modified_at = EXCLUDED.identity_modified_at,
          updated_at = EXCLUDED.updated_at,
          record = EXCLUDED.record
      `;
      await transaction`DELETE FROM threat_intel.actor_identity_aliases WHERE actor_identity_id = ${identity.id}`;
      for (const [relationship, label] of labels(identity)) {
        const alias = {
          id: stableId("actor-identity-alias", `${identity.id}:${normalizeActorLabel(label)}`),
          tenantId: identity.tenantId,
          catalogId: identity.catalogId,
          actorIdentityId: identity.id,
          sourceId: identity.sourceId,
          captureId: identity.captureId,
          label,
          normalizedLabel: normalizeActorLabel(label),
          relationship,
          updatedAt: identity.updatedAt
        };
        await transaction`
          INSERT INTO threat_intel.actor_identity_aliases (
            id, tenant_id, catalog_id, actor_identity_id, source_id, capture_id, label, normalized_label, relationship, updated_at, record
          ) VALUES (
            ${alias.id}, ${alias.tenantId ?? null}, ${alias.catalogId}, ${alias.actorIdentityId}, ${alias.sourceId}, ${alias.captureId},
            ${alias.label}, ${alias.normalizedLabel}, ${alias.relationship}, ${alias.updatedAt}, ${json(alias)}::text::jsonb
          )
        `;
      }
    }
    await afterPersist?.(transaction);
  });
}

function labels(identity: any): Array<["canonical" | "associated", string]> {
  return [["canonical", identity.canonicalName], ...(identity.associatedNames ?? []).map((label: string) => ["associated" as const, label])];
}

function json(value: unknown): string {
  return JSON.stringify(value);
}
