# Evidence Endpoint Proof Commands

These smoke commands prove the mounted evidence routes used by Agent 09 polling and Agent 10 promotion packets. Run them against a local scraper API server seeded with the evidence endpoint fixtures from `src/tests/evidenceEndpoints.test.ts`.

## Pass
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/replay-plan?q=APT29&runId=run_pass"
```

Expected output fields:
```json
{
  "replayPlan": {
    "replayable": true,
    "redaction": {
      "sensitiveBodiesExposed": false,
      "objectKeysExposed": false
    }
  }
}
```

## Cutover Ready
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/cutover-report?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z"
```

Expected output fields:
```json
{
  "cutoverReport": {
    "readiness": { "overall": "ready" },
    "promotionGate": {
      "agent09Fields": { "cursorReplayReady": true },
      "agent10Fields": { "objectIntegrityReady": true }
    }
  }
}
```

## Trust Ledger Ready
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/trust-ledger?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z"
```

Expected output fields:
```json
{
  "trustLedger": {
    "trustGate": "ready",
    "counts": { "trusted": 1, "blocked": 0 },
    "claims": [
      {
        "claimId": "incident_run_pass",
        "ledgerIds": ["ledger_run_pass"],
        "graphRelationshipIds": ["rel_run_pass"],
        "trustStatus": "trusted",
        "replayable": true
      }
    ],
    "safeOutput": {
      "sensitiveBodiesExposed": false,
      "objectKeysExposed": false,
      "unsafeRestrictedMetadataExposed": false
    },
    "enforcement": {
      "state": "pass",
      "releaseAction": "promote",
      "canPromote": true,
      "downstream": {
        "agent07AnswerReadiness": "ready",
        "agent08GraphExportGate": "ready",
        "agent10ReleasePacket": "promote"
      }
    },
    "certification": {
      "status": "certified",
      "releaseAction": "promote",
      "canCutover": true,
      "fixtures": {
        "cleanCutover": "covered",
        "missingObject": "covered",
        "hashMismatch": "covered",
        "staleExtractorReplay": "covered",
        "restrictedMetadataRedaction": "covered",
        "retiredSource": "covered",
        "graphHold": "covered",
        "lowConfidence": "covered",
        "duplicateClaim": "covered",
        "cursorGap": "covered",
        "retentionExpiry": "covered",
        "legalHold": "covered",
        "objectStoreWriteFailure": "covered"
      },
      "downstream": {
        "agent07AnswerReadiness": "ready",
        "agent08ExportGate": "ready",
        "agent10ReleaseTrain": "promote"
      }
    }
  }
}
```

The same mounted proof is available for Agent 07/08 consumers at:
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/claim-ledger?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z"
```

Expected top-level field: `claimLedger`.

## Stale Snapshot Hold
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/cutover-report?q=Stale%20Actor&runId=run_stale&generatedAt=2026-05-24T22:01:00.000Z"
```

Expected output fields:
```json
{
  "cutoverReport": {
    "readiness": { "agent09": "hold", "overall": "hold" },
    "counts": { "staleSnapshots": 1 },
    "promotionGate": { "blockers": ["stale_snapshot_rebuild"] }
  }
}
```

## Missing Object Hold
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/cutover-report?q=Missing%20Object&runId=run_missing_object&generatedAt=2026-05-24T22:00:00.000Z"
```

Expected output fields:
```json
{
  "cutoverReport": {
    "readiness": { "agent10": "blocked", "overall": "blocked" },
    "counts": { "missingObjects": 1 },
    "promotionGate": {
      "agent10Fields": { "missingObjectCount": 1 }
    },
    "trustLedger": {
      "certification": {
        "status": "hold",
        "releaseAction": "hold",
        "canCutover": false,
        "objectStore": {
          "missingObjectIds": ["cap_run_missing_object"],
          "writeFailureFixture": "covered"
        }
      }
    }
  }
}
```

## Restricted Redaction
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/cutover-report?q=Restricted%20Actor&runId=run_restricted&generatedAt=2026-05-24T22:00:00.000Z"
```

Expected output fields:
```json
{
  "cutoverReport": {
    "redaction": {
      "sensitiveBodiesExposed": false,
      "objectKeysExposed": false,
      "metadataOnlyCaptureIds": ["cap_run_restricted_restricted"]
    }
  }
}
```

The response must not contain sensitive body text, object keys, private invite paths, or unsafe restricted metadata URLs.

## Graph Export Blocker
```sh
curl -sS "http://127.0.0.1:8097/v1/evidence/cutover-report?q=Graph%20Blocker&runId=run_graph_blocker&generatedAt=2026-05-24T22:00:00.000Z"
```

Expected output fields:
```json
{
  "cutoverReport": {
    "readiness": { "overall": "hold" },
    "exportBlockers": [
      { "id": "delta_run_graph_blocker_relationship", "reason": "delta_contradicted" }
    ],
    "promotionGate": { "blockers": ["export_blockers"] }
  }
}
```

## Invalid Query
```sh
curl -i -sS "http://127.0.0.1:8097/v1/evidence/replay-plan"
```

Expected output fields:
```json
{
  "error": { "code": "bad_request" }
}
```

Expected status: `400`.

## Invalid Run
```sh
curl -i -sS "http://127.0.0.1:8097/v1/evidence/cutover-report?q=APT29&runId=run_missing"
```

Expected output fields:
```json
{
  "error": { "code": "not_found" }
}
```

Expected status: `404`.
