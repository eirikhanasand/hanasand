-- Query to insert a download event into the database. See the download utility
-- function for further details.

INSERT INTO download_events (package_name, package_version, ecosystem, client_address, status, reason, severity)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (timestamp, package_name, package_version, client_address) DO NOTHING
RETURNING *;
