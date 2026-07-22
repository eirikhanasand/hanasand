DELETE FROM threat_intel.evidence_links AS link
WHERE link.subject_type = 'incident'
  AND NOT EXISTS (SELECT 1 FROM threat_intel.incidents AS incident WHERE incident.id = link.subject_id);
