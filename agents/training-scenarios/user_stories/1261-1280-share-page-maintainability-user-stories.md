# Share Page Maintainability User Stories 1261-1280

These stories extend the `/s` share-page AI test set after reviewing real complaints about AI website builders and coding agents. The repeated pattern is that AI gets users started quickly, but then leaves behind slow, messy, hard-to-edit code, unclear ownership, CMS gaps, platform lock-in, and edge-case bugs that require a real developer to untangle.

Success criteria:

- The model prompt includes `Maintainability mode:` for maintainability, ownership, performance, CMS, portability, browser/device bug, and AI-bloat prompts.
- The model context marks `maintainabilityMode: true`.
- The response prefers owned code, clear file structure, small dependencies, semantic accessible markup, and durable content models.
- The model avoids giant generated CSS, opaque widgets, unnecessary client-side code, and hard-coded content when the user implies future editing.
- The response remains concise and still produces actionable project files when an edit is actually requested.

Stories:

1261. A user says an AI builder made messy code no one can maintain.
1262. A local shop needs content they can edit later.
1263. A founder wants owned code and no platform lock-in.
1264. A site became slow from generated CSS bloat.
1265. An agency needs a clean handoff to a developer later.
1266. A corporate team asks whether this scales past a landing page.
1267. A designer asks not to bury layout inside opaque widgets.
1268. A restaurant owner wants a menu content model instead of hard-coded text forever.
1269. A checkout integration will need a custom flow later.
1270. Mobile Safari has a weird bug the AI keeps missing.
1271. A newbie asks whether they can export and keep the code.
1272. A startup says to avoid dependencies they cannot support.
1273. Support says assets are huge and the page crawls.
1274. Compliance needs semantic accessible markup.
1275. A freelancer inherited a vibe-coded mess.
1276. An operator wants less client-side code.
1277. A product owner needs maintainable content sections.
1278. A client asks why AI code is hard to refactor.
1279. A business says weird browser bugs matter more than fancy visuals.
1280. A product owner asks whether these maintainability stories match real-world complaints.
