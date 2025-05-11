-- Query to fetch the statistics summary. See the statistics handler for further details.

SELECT 
    COUNT(*) AS total_scanned,
    COUNT(*) FILTER (WHERE status = 1) AS safe_approved,
    COUNT(*) FILTER (WHERE status = 2) AS vulnerabilities_found,
    MAX(timestamp) AS last_scan
FROM download_events
WHERE timestamp BETWEEN $1 AND $2;
