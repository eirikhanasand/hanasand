# Hanasand Mill — implementation goal

## Product decision

Build Hanasand Mill as the log-monitoring and MDR workflow inside the existing Hanasand product. The public ingestion address is:

```text
https://api.hanasand.com/mill
```

The route is intentionally a single JSON endpoint. Customer organizations use the existing Hanasand organization API-key flow; the key identifies the tenant and the ingestion scope. The authenticated analyst experience stays inside the existing Hanasand dashboard and organization model.

“Mill” is the working product name because it describes raw events being processed into useful findings. It does not require a separate product identity or a second tenant system.

## Implementation status

The initial ingestion and analyst slice is deployed. The next completion slice adds analyst filtering, persisted decision notes and assignment, audit events, and organization-workspace visibility for the existing API key used by Mill. Keep this section current as the goal is delivered in slices; the acceptance criteria below remain the source of truth.

## First implementation slice

The first slice must be real and usable:

1. Accept one JSON event or a batch of JSON events at `POST /mill`.
2. Authenticate the request with an active organization API key.
3. Persist the original payload with its organization, source, event time, and ingestion ID.
4. Normalize the small set of fields needed for authentication analysis without discarding unknown fields.
5. Create first-pass findings for suspicious authentication activity:
   - repeated failures followed by a success;
   - impossible travel when two successful events for one user are geographically incompatible;
   - logins from a new country when country context is present.
6. Expose tenant-scoped events and findings to an authenticated Mill analyst page.
7. Let an analyst inspect evidence and move a finding through review states.
8. Reuse existing organization membership, API-key, role, audit, API, database, and visual patterns.

This slice does not implement Azure, Defender, external collectors, packet inspection, or a large third-party rule catalog. The schema and normalized event shape must leave room for those adapters later.

## API contract

### Ingestion

```http
POST https://api.hanasand.com/mill
Authorization: Bearer hsk_<organization-key>
Content-Type: application/json
```

Accepted body forms:

```json
{
  "source": {"vendor": "custom", "product": "identity"},
  "events": [
    {
      "timestamp": "2026-08-03T08:15:00Z",
      "event_type": "authentication",
      "action": "login",
      "outcome": "success",
      "user": {"id": "user-123", "email": "user@example.com"},
      "source": {"ip": "203.0.113.10", "country": "NO", "city": "Oslo"}
    }
  ]
}
```

The endpoint must acknowledge accepted events with an ingestion ID and counts. Invalid events must be rejected with field-level information. Unknown source fields remain in the original payload.

### Portal API

Authenticated routes should be tenant-scoped through the selected organization:

- `GET /mill/events?organizationId=...`
- `GET /mill/findings?organizationId=...`
- `POST /mill/findings/:id/actions`

These routes must use the existing session and organization membership checks. A user must never see another organization’s events or findings.

## Data model

Persist both the source event and the normalized representation.

### Mill event

- ID and ingestion ID
- Organization ID
- Source vendor and product
- Event timestamp
- Received timestamp
- Event type, action, and outcome
- User identifier and display identity
- Source IP, country, city, and device identifier when available
- Normalized JSON
- Original JSON
- Parser version
- Processing status

### Mill finding

- ID and organization ID
- Detection rule ID and version
- Severity
- Status: `new`, `investigating`, `benign`, `resolved`, `suppressed`
- Summary
- Evidence JSON
- First observed and last observed timestamps
- Related event IDs
- Assignee
- Analyst note
- Created and updated timestamps

Use PostgreSQL JSONB for original and normalized fields. Keep the first rule implementation in ordinary TypeScript so it is easy to test and replace with a broader rule engine when there is real rule volume.

## Detection approach

The first detection pass is intentionally narrow and evidence-first.

### Suspicious authentication

Detect a successful login after a configurable number of failures for the same user and source context. The finding must show the failed-event IDs, the success-event ID, time span, and source IPs.

### Impossible travel

Compare successful events for the same user when both events include coordinates or a supported country/city mapping. Do not claim impossible travel when location data is missing. Store the two events, distance estimate, elapsed time, and the threshold used.

### New country

Compare the event’s country with recent successful countries for the same user. This is a triage finding, not proof of compromise. Show the prior observed countries and the first-seen timestamp.

### Future rule families

The event and finding model must support later additions for:

- Sigma-style event rules;
- Hanasand-authored rules;
- known malicious IP, domain, URL, and hash matches;
- CVE context when asset and version data is present;
- Snort/Suricata-compatible network records when the source provides compatible fields;
- future Azure, Defender, and other vendor adapters.

Snort signatures are not applied blindly to arbitrary JSON. They need network metadata or a source adapter that can provide equivalent fields.

## Mill analyst workflow

Add a compact authenticated workspace at `/dashboard/mill`.

The page should contain:

- selected organization context;
- a findings queue sorted by severity and newest activity;
- filters for status, severity, source, and user;
- event and finding counts;
- a selected finding detail panel;
- evidence rows and a timeline;
- original JSON inspection;
- rule explanation;
- assignee, status, and note controls;
- loading, empty, error, and permission states.

The organization page should link to Mill and show whether the organization has an ingestion key. Key creation and revocation must continue to use the existing organization API-key controls.

## Security and tenant rules

- The ingestion key is never stored in the frontend.
- API-key secrets are only returned at creation time through the existing key flow.
- Ingestion must require an active organization key with the Mill scope.
- Portal reads require a valid Hanasand session and active organization membership.
- Every query includes organization scope.
- Raw payloads are retained only as needed by the existing organization retention settings.
- Secrets such as passwords, bearer tokens, and session cookies should be redacted before persistent raw storage.
- All analyst state changes use the existing audit conventions.

## Acceptance criteria

- A real organization API key can submit a valid JSON event to `/mill`.
- The response reports acceptance and an ingestion ID.
- Invalid or unauthorized submissions fail safely.
- Events persist under the correct organization.
- At least one suspicious-login finding can be generated from stored events.
- A user can open `/dashboard/mill`, select an organization, inspect a finding, and update its status.
- A user cannot read another organization’s data by changing `organizationId`.
- Existing organization, API-key, DWM, TI, and internal service-log behavior remains intact.
- The UI uses existing Hanasand layout tokens, controls, themes, and navigation patterns.

## Deliberately deferred

- Separate collectors for Azure or Defender.
- Packet-level Snort/Suricata inspection.
- Full Sigma repository ingestion.
- CVE exploit attribution without asset context.
- Customer-facing billing and packaging.
- Large-scale streaming infrastructure.
- A separate tenant, identity, or permissions system.
