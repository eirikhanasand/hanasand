# Hanasand Security Validation Scanner

## Product goal

Build a Qualys-style defensive scanner inside Hanasand. The first approved scope is Hanasand-owned infrastructure, beginning with `https://hanasand.com`. The scanner must discover assets and security weaknesses, validate findings with safe read-only checks, preserve evidence, and make its own activity visible to Security Monitoring.

The scanner is not an exploit repository. A successful validation means that a bounded check proved a condition using harmless evidence such as a response header, service banner, synthetic canary, or dedicated test account. It must never dump real secrets, brute-force credentials, alter production data, establish persistence, or execute arbitrary payloads.

## First slice

- System-admin-only scanner workflow in the existing Hanasand dashboard.
- Persistent scan state and scan identifier.
- HTTPS reachability and response-status checks.
- HSTS, CSP, clickjacking, MIME-sniffing, and server-fingerprint checks.
- Small approved TCP port set: 80, 443, 8080, and 8443.
- Explicit `Hanasand-Security-Scanner/1.0` user agent and scan ID header.
- Security Monitoring rule for normalized scanner activity.
- Focused tests that prove the scanner remains non-invasive and bounded.

## Later slices

- DNS, certificate, subdomain, container, dependency, and authenticated asset inventory.
- OWASP-aligned web checks and tenant-isolation validation using synthetic canaries.
- CVE correlation with asset, version, reachability, exploitability, and remediation evidence.
- BloodHound-style identity and permission graph for Hanasand-owned identities.
- Controlled validation plugins with declared prerequisites, impact level, evidence, and cleanup.
- Access-log/CDN telemetry bridge into Security Monitoring so each scan request is automatically correlated with the scan job.

## Acceptance criteria

- A system admin can start a scan from the dashboard.
- Only explicitly approved Hanasand targets are accepted.
- Scan activity is rate-limited, identifiable, and read-only.
- Results persist across API restarts.
- Findings show evidence and distinguish pass, warning, failure, and error.
- Scanner requests can be recognized by Security Monitoring.
- No exploit payloads or arbitrary code execution are part of the scanner contract.
