# Share Page Cost Control User Stories 1241-1260

These stories extend the `/s` share-page AI test set after another Reddit review. The recurring real-world complaint is not only that AI website builders fail, but that they spend the user's paid credits, retries, and patience while making broad unrelated rewrites. The desired behavior is a small, named, reversible change with the current project shape preserved.

Success criteria:

- The composer shows cost control mode for credit burn, retry, version drift, restore, wrong-secret, or minimal-edit prompts.
- The model prompt includes `Cost control mode:`.
- The model context marks `costControlMode: true`.
- The response names the guarded scope before any tool tags.
- The UI hides raw tool tags and leaves exactly one reviewable pending change.
- The run finishes fast enough that the user does not feel another paid retry loop starting.

Stories:

1241. A v0-style user says the AI made the site worse and spent their credits.
1242. A developer asks for a button fix and explicitly does not want a whole-site rewrite.
1243. A long-running project at version 20 feels slower and less accurate.
1244. A user already paid twice to fix the same mistake.
1245. A newbie asks to only change hero text.
1246. A designer wants a tiny spacing tweak only.
1247. An agency client says to preserve everything else.
1248. A corporate reviewer rejects surprise rewrites.
1249. A founder has five minutes before a demo and cannot absorb risk.
1250. The AI keeps asking for the wrong secret after the user switched providers.
1251. Support says repeated retries burn user trust.
1252. A pricing page was replaced with a different site.
1253. A freelancer needs one minimal client change.
1254. A restaurant owner asks to restore the old menu section.
1255. Compliance asks for no unrelated file edits.
1256. Mobile nav broke after a simple prompt.
1257. A startup says every rerun costs money.
1258. An operator wants the smallest safe patch.
1259. A client says to just fix the broken link.
1260. A product owner asks whether these cost-control stories match real-world complaints.
