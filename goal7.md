# Hanasand Security Validation Scanner — scheduled product goal

## Objective

Make the scanner a continuously operated Hanasand product. Every organization is currently scoped to the single authorized target `https://hanasand.com`; the Hanasand organization runs automatically 24/7 by default, with the schedule visible and configurable by an authorized system administrator.

## Product workflow

The scanner surface must let an operator:

1. Run a scan immediately.
2. See current and historical scans.
3. Plan future scans and configure recurring execution.
4. Open scan details showing target, start/end time, duration, checks, evidence, errors, and findings.
5. Review actionable severity totals and jump to the matching findings.

The public `/solutions/scanner` page explains the product. The authenticated `/dashboard/scanner` page is the working console and appears in the internal sidebar.

## Safety boundaries

- Only `https://hanasand.com` is accepted until scope management is explicitly implemented and approved.
- Checks remain read-only and rate-limited.
- Scanner requests carry a stable user agent and scan ID for Security Monitoring correlation.
- No brute force, destructive requests, persistence, arbitrary payloads, or exploit delivery.
- Scheduler state, scan history, and findings survive API restarts.

## Acceptance criteria

- A scheduled worker runs the Hanasand organization scan continuously.
- An operator can pause, resume, change cadence, and run now from the UI.
- A history list persists completed and failed runs.
- Scan detail exposes duration, target, checks, evidence, errors, and severity counts.
- Severity sections are actionable rather than decorative.
- Public solution discovery and authenticated sidebar navigation both work.
- Focused tests cover scope enforcement, scheduling, history, severity aggregation, and scanner telemetry.
