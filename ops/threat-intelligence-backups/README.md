# Threat intelligence backups

Backup archives are stored outside the source checkout under
/var/backups/hanasand/threat-intelligence. The July 22, 2026 pre-028 recovery
backup was moved there from the top-level ti-backups directory.

The dump and evidence archive are large backup data and stay outside Git. Their
small SHA256SUMS manifest is tracked with this record and can verify the files
in the dated directory. The normal Hanasand backup job writes current backups
to /var/backups/hanasand.
