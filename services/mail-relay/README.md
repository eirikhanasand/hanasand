# Private outbound mail relay

System mail travels through Inspur Stalwart → the Inspur SSH connector → OVH Stalwart → recipient MX. Local mailbox delivery remains local. Only `noreply@hanasand.com` uses this route; other senders keep their existing routing.

## Services and health

| Host | Container | Local health | Public readiness API |
| --- | --- | --- | --- |
| Inspur | `hanasand-mail-relay-inspur` | `127.0.0.1:19261/health` | `https://api.hanasand.com/api/mail-relay/inspur/health` |
| OVH | `hanasand-mail-relay-ovh`, `hanasand-mail-relay-ovh-health` | `127.0.0.1:19262/health` | `https://api.hanasand.com/api/mail-relay/ovh/health` |

Checks run every 30 seconds. HTTP 200 means ready; HTTP 503 means a dependency failed, a message is over five minutes old, the queue exceeds 100 messages, or the sample is stale. Inspur checks its SMTP authentication, queue, tunnel, and OVH authentication. OVH checks SMTP authentication, queue, and an external Microsoft SMTP greeting. Probes never send DATA and authenticated probes never issue RCPT, avoiding recipient quotas. Readiness cannot establish inbox placement; outbound logs provide recipient-server acceptance.

`api/scripts/setup-mail-relay-monitoring.ts` idempotently creates exactly two named one-minute health jobs using the existing Hanasand API monitor owner and notification destinations. Existing job preferences are preserved.

## Security and persistence

- SMTP and management listeners bind only to loopback or private Docker networks; no public relay port is exposed.
- Dedicated SSH key, pinned host key, no shell, and only two permitted forward destinations. SSH reconnects automatically with bounded keepalive failure detection.
- STARTTLS and certificate validation are required on the relay route. Dedicated relay principal can authenticate/send only and is restricted to its sender address. Queue health principals have read-only queue permissions.
- Containers run as UID 1000, without capabilities, with read-only root filesystems, restart policies, resource limits and rotating logs. Connector replacement preserves its Inspur address because API pairs capture network aliases.
- Secrets live under `~/resilience-mail-relay`, mode 0700, with secret files mode 0600. OVH SMTP storage is durable in `data`; never remove this directory or the existing unrelated mail service during redeployment.
- OVH uses SPF authorization for `192.99.32.185` and RSA DKIM selector `ovhrelay202609`. Its private signing key stays in the relay datastore; publish only the public TXT record. Existing MX records are unchanged.
- Hourly certificate refresh uses the existing OVH certificate, atomically writes private files, and reloads Stalwart on renewal. Logs use the `hanasand-mail-relay-tls` syslog tag.

## Deploy from a pushed revision

Fetch main on each host; build the health image directly from `git archive <revision>:services/mail-relay`. Execute setup from `git show <revision>:services/mail-relay/setup.py`, selecting `inspur` or `ovh` and `--image <built-image>`. No working checkout replacement or file copying is needed. The Stalwart image is pinned and setup deliberately refuses unattended mail-server image upgrades.

Provision the restricted SSH key and remote SMTP credential locally before initial Inspur setup. Do not print credentials, DKIM generation responses, or message contents. Initial OVH DNS setup must authorize the outbound IP and publish the generated DKIM public key before activation; configure `auth.dkim.sign` to `['ovh-relay-rsa']` and reload `/api/reload`.

Run setup on Inspur with `--activate` only once relay authentication passes. This preserves a protected `route-before.json` snapshot and configures the sender route with mandatory TLS. Run setup on OVH with `--renewal-revision <full-pushed-sha>` to install certificate refresh; `--refresh-tls` also runs it immediately.

After deployment check both public APIs, both named jobs, and actual delivery logs. A queue is preserved across restarts and failures. If the relay fails, leave mail queued, repair the failing dependency, then verify recipient acceptance. Do not silently fall back to blocked direct outbound delivery or weaken TLS. Restore prior route settings from the protected snapshot only as an explicit rollback.
