# Share Page Pending Checkpoint User Stories 1181-1200

Objective: the `/s` page must protect unapplied AI edits as a clear checkpoint. Users should not accidentally replace pending work by sending another prompt while a draft is waiting for review.

Strict success criteria for every story:

- The first AI response is visible within 2.5 seconds in the mocked user-story test.
- A pending edit is visible in the website UI.
- The composer blocks a new AI run while that edit is pending.
- The UI says to apply or discard the pending change before asking for another edit.
- `Apply` remains available when proof is not failed.
- `Discard` is visible and clears the pending edit.
- After discard, the composer becomes usable again.
- Raw `hanasand-tool` tags never appear.

## Stories

1181. A founder says, "don't lose the edit if I type another thing." The pending draft should become a checkpoint.

1182. A designer wants review before the next request. The UI should block accidental follow-up prompts until the draft is resolved.

1183. A total newbie keeps typing instead of applying. The send button should make the required next step obvious.

1184. A corporate reviewer needs assurance that pending work is not silently overwritten by another run.

1185. Ops wants pending work to behave like a release checkpoint, not terminal scrollback.

1186. An agency client changes their mind mid-review. They need a visible discard path.

1187. Support says users lose pending diffs. The pending panel must stay visible until the user acts.

1188. A founder sends rapid followups. The app should prevent clobbering the prepared change.

1189. An accessibility reviewer wants no accidental replacement of a reviewed edit.

1190. A pricing page edit is ready, but the user asks for more. The product should ask them to resolve the pending draft first.

1191. A mobile review is pending, then another request arrives. The checkpoint should protect the mobile fix.

1192. Compliance needs explicit discard so rejected edits do not linger ambiguously.

1193. An investor page is ready; another prompt must not clobber it before review.

1194. A restaurant owner types twice by mistake. The second prompt should wait until the first draft is applied or discarded.

1195. A user coming from terminal agents says pending state is too easy to miss. The website must show it as a first-class UI state.

1196. Another agent receives a handoff. The checkpoint should make the current state understandable without reading the full chat.

1197. A client asks how to start over safely. `Discard` should clear pending work and re-enable the composer.

1198. A designer rejects the draft and wants another direction. Discard should be faster than writing a new corrective paragraph.

1199. A beginner says, "I don't want that change." The answer should be a visible button, not instructions.

1200. Product owner asks whether this still prioritizes safe, fast progress. Blocking accidental clobbering while offering discard keeps speed without hiding state.
