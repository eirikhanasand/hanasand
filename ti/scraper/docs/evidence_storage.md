# Evidence Storage

## Model
- Raw capture evidence is immutable.
- Extracted intelligence is stored separately from raw evidence.
- Sensitive or restricted captures are metadata-only.
- Object storage keeps large public captures outside API responses.

## Capture Contract
- Required: source id, URL or URL hash, collected time, content hash, media type, storage kind.
- Optional: title, published time, language, object ref, retention class, provenance.
- Public responses must redact object keys and sensitive bodies.

## Deduplication
- Canonical URL plus source plus publication time.
- Normalized text/content hash plus source plus publication time.
- Duplicate suppression must not mutate existing captures.

## Replay
- Replays read immutable captures and produce new extraction results.
- Replay jobs record extractor version, run id, status, indicator/entity deltas, and mutation checks.

## Retention
- Public report and advisory evidence can live longer.
- Discovery snippets, live-search snapshots, and deltas are short-lived.
- Restricted metadata stays metadata-only.
- Legal hold prevents body deletion.

## Search Handoff
- Search read models expose safe summaries, hashes, timestamps, and confidence.
- Vector/search indexes must be rebuildable from evidence metadata and public-safe text projections.

## Live Search Promotion
- Discovery snippets may be promoted to captures and incidents.
- Polling clients consume cursors and evidence deltas.
- Stale snapshots are pruned by retention policy.

## Production Layout
- Metadata snapshot under `TI_EVIDENCE_METADATA_PATH`.
- Object bodies under `TI_EVIDENCE_OBJECT_DIR`.
- Keep both under the evidence volume in production.
