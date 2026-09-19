# Copy style

Use simple, natural language that a person would say out loud. This applies to alerts, case summaries, UI text and documentation.

- Say what the product does, what happened, or what to do next.
- Use short sentences and concrete verbs.
- Prefer `check`, `find`, `show`, `send`, `save`, `run`, and `open`.
- Use the name of the real thing: page, alert, source, record, case, API, webhook, or worker.
- Avoid vague terms such as `surface`, `lane`, `readiness`, `proof`, `handoff`, `artifact`, `operational`, and `workflow` unless they are part of a protocol, field name, or established technical concept.
- Do not turn implementation details into product language. Say “where the information came from,” not “source provenance.” Say “the page,” not “the product surface.”
- Do not stack multiple nouns together. Rewrite “customer workflow proof” as “a test of the customer flow.”
- Keep one idea per sentence. Remove claims that do not help someone use, debug, or evaluate the product.

Before merging copy, read it out loud. If it sounds formal or makes a simple problem hard to understand, rewrite it. Say “WAL replication lost. Restore the replica from a backup.” Keep timestamps, checksums and detailed logs in the case. Preserve facts: an upload failure is different from a backup failure, and a responding service does not mean its backup or replica has recovered.

Documentation should cover purpose, configuration, commands, data storage and known limits. Describe what exists; distinguish examples from working integrations. Keep the README brief and link to component documentation for details. Avoid slogans, self-praise, and terms such as ‘harness’ or ‘fixture’ when ‘test’ or ‘example’ is clearer.
