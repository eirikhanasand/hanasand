# Relationship And Export Model

## Relationships
- Actor to victim.
- Actor to malware/tool.
- Actor to TTP.
- Actor or incident to CVE.
- Source/capture/incident provenance.

## Confidence
- Raise confidence with corroboration, fresh source support, specific victim/sector/country, and extraction quality.
- Lower confidence for stale, generic, contradictory, graph-only, or restricted-only evidence.
- Do not count source-provenance rows as findings.

## Graph Updates
- Progressive updates carry discovery, capture, extraction, relationship, and export stages.
- Each relationship must preserve source id, capture id, content hash, extractor version, and confidence.

## ATT&CK
- TTP mapping should include technique id/name when supported.
- Text-only guesses remain lower confidence until corroborated.

## STIX
- STIX export is useful for later integrations, but it should not displace buyer-visible row quality.
- Export only safe metadata and public-safe summaries.

## TAXII
- TAXII remains a future delivery channel.
- Build only when there is buyer demand or a clear integration target.
