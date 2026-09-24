import { createHash } from 'node:crypto';
import { redactLogValue } from '../../api/src/utils/logs/redact.ts';

// Keep each JSON line below Docker's partial-record boundary, even with escaped
// characters. Large bodies are retained in ordered parts, never silently cut.
const PART_CHARACTERS = 1500;
export function promptEvidence(body, context) {
  const redacted = JSON.stringify(redactLogValue(body));
  const parts = Math.max(1, Math.ceil(redacted.length / PART_CHARACTERS));
  const bodySha256 = createHash('sha256').update(redacted).digest('hex');
  return Array.from({ length: parts }, (_, index) => ({
    ...context, event_type: 'model_prompt', level: 'info', protected: true,
    method: 'POST', path: '/v1/chat/completions', bodyEmpty: false,
    body_encoding: 'json-text-parts', body_sha256: bodySha256,
    body_part: index + 1, body_parts: parts, body_redacted: true, body_truncated: false,
    body: redacted.slice(index * PART_CHARACTERS, (index + 1) * PART_CHARACTERS),
  }));
}
export function writeEvidence(event) { console.log(JSON.stringify(event)); }
export function logPromptEvidence(body, context, write = writeEvidence) {
  for (const event of promptEvidence(body, context)) write(event);
}
