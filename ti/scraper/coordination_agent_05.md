Status: active_task_ab

## CURRENT ASSIGNMENT - READ FIRST

Task AB: Restricted Metadata Analyst Operations, Isolation Proof, And Victim-Safe Workflow

Own the restricted-source operations layer that CTI teams can trust under legal and safety pressure. Do not wait for another prompt. The product needs Tor/I2P/Freenet/leak-site metadata to be operationally useful without ever becoming raw leaked-data collection: metadata-only queueing, approval workflows, proxy isolation proof, kill-switch drills, retention/legal hold, redaction repair, victim/company notification packets, and clear public-answer caveats.

Deliver typed contracts and fixtures for approval requested, approval granted, approval expired, kill switch active, proxy isolation failure, timeout, unsafe download/form/contact target, raw payload blocked, private/invite target blocked, metadata-only capture queued, metadata-only capture promoted to review, duplicate victim claim, contradictory actor statement, retention expiry, legal hold, redaction repair, low-yield restricted source, victim notification packet, and emergency stop rollback. Cover ransomware/victim queries, named company leak claims, actor leak-site claims, APT/ransomware groups, CVE exploit leak claims, country/sector queries, and made-up/random actors.

Wire to `/v1/restricted-metadata/status`, `/v1/restricted-metadata/apply-plan`, `/v1/intel/search.restrictedMetadata`, `/v1/intel/search.analystLoop`, `/v1/evidence/claim-ledger`, `/v1/contracts`, Agent 01 governance, Agent 02 scheduler isolation/backoff, Agent 06 evidence/redaction/retention, Agent 07 answer states, Agent 08 graph holds, Agent 09 public warnings, and Agent 10 emergency-stop gates. Verify darknet/API/evidence/full tests, typecheck, route inventory, restricted status/apply-plan scripts, no-leak serialization, and docs/runbook updates. Hard constraints remain: no stolen data download, no credentials, no auth/CAPTCHA bypass, no private access, no threat-actor interaction, no raw unsafe URLs in public output.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AC: Restricted Connector Isolation Harness And Compliance Evidence

After Task AB proof is complete, continue directly into Task AC. Build a non-networked isolation harness contract for Tor/I2P/Freenet metadata connectors: proxy boundary proof, kill-switch propagation, timeout attribution, denied raw payload attempts, unsafe-form/contact detection, no credential storage, no private access, and no threat actor interaction. Emit compliance evidence packets for legal/security review and Agent 10 release gates. Verify restricted tests, ops docs, and no-leak serialization.

Task AD: Victim Claim Deduplication And Notification Workflow

Build metadata-only victim claim dedupe across restricted metadata, public channels, and clear-web reports. Normalize company/victim names, actor statements, claimed dates, account counts, dataset sizes, source hashes, and legal holds. Emit analyst review tasks, victim notification packets, duplicate/contradicted claim states, and retention/redaction actions. Wire to Agent 06 claim ledger, Agent 07 answer states, Agent 08 graph holds, and Agent 09 API warnings.

# Agent 05 Summary

- Added restricted metadata `nonBlockingSearch` semantics for approved canary, approval gaps, expiry, kill switch, proxy failure, timeout, unsafe target, low-yield, retention/legal hold, redaction repair, query-class, and public API blocked-state scenarios.
- Wired `nonBlockingSearch` into restricted status, apply-plan, intel search restricted metadata, contracts, Agent 06 evidence gates, Agent 07 public-answer states, Agent 09 warnings, Agent 10 emergency-stop board decisions, proof scripts, API tests, and the operations runbook.
- Verified metadata-only/no-contact/no-download/no-bypass/no-CAPTCHA/no-stealth/no raw payload or URL/no public-answer promotion/no-leak serialization guarantees while clear-web and public-channel search continue with zero added latency.
- Kept verification green: `bun run check`, `bun test`, `bun run check:restricted-metadata-status`, `bun run check:restricted-metadata-apply-plan`, and `bun run check:route-inventory`.
- Superseded by active Task AB above; do not request another assignment until Task AB proof is complete.
