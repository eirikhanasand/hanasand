# Resilience runtime data

This is the Hanasand resilience runtime directory, moved here from
/home/hanasand/resilience. The old path remains a symlink to preserve existing
service, timer, container, and deployment references while they are migrated.

The maintained application and deployment code is tracked in the project
source, including scripts/resilience. This directory holds mutable production
state and credentials, generated release snapshots, logs, backups, and a stale
source snapshot. These files are intentionally excluded from Git. Keep runtime
secrets in this directory or the separate resilience-secrets directory and do
not add them to the project history.
