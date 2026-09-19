# Host and VM log collection

The Linux collector sends audit executions, system journal entries and Docker stdout/stderr to `/api/logs/ingest`. Original levels are retained; Mill assigns the separate detection severity. Every execve/execveat from every user and service is audited. Shell built-ins do not create execve events; a shell invocation retains its command arguments. Audit collection requires root and kernel audit support.

Run `install.sh <host-id>` as root on Debian/Ubuntu (Python 3.9+, systemd). It installs persistent audit rules, the collector and an enabled service, but does not start delivery. Configure its protected credential, then start it only after the ingestion API is ready:

```sh
python3 configure.py inspur /path/to/protected/log-ingest.json
systemctl start hanasand-log-collector
```

The credential source is a root-restricted JSON object containing `LOG_INGEST_TOKEN`, generated outside source control. `configure.py` preserves existing collection start time, writes mode 0600 and prints no credential. Use the dedicated ingestion credential, never a human session or a broad VM API token. A remote credential may be supplied on standard input with `-`. Do not put it in command arguments, logs or shell history.

State is stored under `/var/lib/hanasand-log-collector` and only advances after acknowledged durable ingestion. Stable event IDs make retries safe. Journal rotation resumes by timestamp; audit rotation uses ausearch's checkpoint recovery. A failed Docker container does not block other containers. `HANASAND_LOG_CONFIG` and `HANASAND_LOG_STATE` support a restricted user service that collects readable journal/Docker logs; this does not grant audit access.

On LXD hosts, the collector discovers running guests every 30 seconds, installs the same audit rules and reads guest audit, journal and Docker events through LXD. Each guest keeps an export spool and separate cursors until the host acknowledges successful ingestion. The ingest credential never enters a guest. Guest events identify both the physical host and VM. Stopped guests are left stopped and enrolled the next time they run; installation/network failures remain visible in high-severity collector health events. This cannot collect events occurring before a new guest's first audit enrollment. Full VMs need a working LXD agent; unprivileged containers cannot independently enable kernel auditing and report that limitation.

Structured secret fields, common password/token flags, HTTP credentials, cookies and authorization values are redacted before delivery. Redaction is best effort: positional or unusually named secrets may remain in command arguments, so log access must remain restricted. Source output is not modified. The Linux collector does not cover macOS, unreachable hosts or machines lacking administrative access; report those gaps explicitly.

Run regression checks with `python3 -m unittest discover -s ops/log-collector -v`. Verify a real harmless `whoami` execution reaches Mill as `ProcessLogs` on each enrolled host and guest; dangerous patterns belong only in synthetic fixtures.
