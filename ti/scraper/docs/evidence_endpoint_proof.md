# Evidence Endpoint Checks

## Endpoints
- `/v1/evidence/replay-plan`
- `/v1/evidence/cutover-report`
- `/v1/evidence/trust-ledger`
- `/v1/evidence/claim-ledger`

## Expected Pass Shape
- Replay is possible.
- Trust gate is ready.
- Sensitive bodies are not exposed.
- Object keys are redacted.
- Claim ledger links claim ids, ledger ids, and graph relationship ids.

## Expected Hold Shapes
- Stale snapshot hold.
- Missing object hold.
- Restricted metadata redaction.
- Graph contradiction/export blocker.
- Invalid query or run id.

## Safety Checks
- No raw body fields.
- No raw object keys.
- No unsafe restricted URLs.
- No hidden restricted body text.

## Current Note
The split endpoint tests still expose a mounted-route 404 in `startApiServer`; that is a route integration issue, not a file-length issue.
