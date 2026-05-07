# Share Page Pending Change Summary User Stories 1201-1220

Objective: pending AI edits on the `/s` page should be understandable before a user opens or reads raw code. This improves speed and trust for designers, beginners, agencies, corporate reviewers, and handoff agents.

Strict success criteria for every story:

- The AI response appears within 2.5 seconds in the mocked user-story test.
- The pending change panel shows action and path, such as `Create app/page.tsx`.
- The panel shows total line count, added line count, removed line count, and file kind.
- Raw diff remains available, but the summary appears first.
- `Apply` and `Discard` remain visible.
- The current share URL is included in the prompt/context and visible in the UI.
- Raw `hanasand-tool` tags never appear.

## Stories

1201. A founder asks, "what changed, don't make me read code first." The panel should answer with a compact summary before raw diff.

1202. A designer wants a quick file summary. They should see file path, size, and change type without reading code.

1203. A total newbie asks whether this is a new file. The UI should say `New file`.

1204. A corporate reviewer needs line counts. Added and removed counts should be visible.

1205. Ops wants added and removed counts visible for fast risk triage.

1206. An agency client hates raw diffs first. Summary should lead; diff should be available below.

1207. Support says pending diffs look scary. Make the first visible layer smaller and friendlier.

1208. A founder skims before demo. They should understand the scope in seconds.

1209. An accessibility reviewer wants file scope quickly before reviewing implementation.

1210. A pricing change needs compact evidence of what file changed and how much.

1211. A mobile fix is ready. The user wants to know its size before applying.

1212. Compliance wants no mystery patch. Every pending file needs a readable summary.

1213. An investor page diff needs quick read before a demo link is shared.

1214. A restaurant owner does not know diff syntax. They still need confidence before applying.

1215. A user coming from terminal agents complains about walls of patch output. Hanasand should summarize before showing patch text.

1216. Another agent receives handoff. File summaries should make pending work understandable without reading the whole chat.

1217. A client asks how big the change is. The pending panel should answer directly.

1218. A designer rejects huge unseen edits. Visible line counts help catch oversized changes early.

1219. A beginner wants confidence before pressing apply. The summary should be readable and compact.

1220. Product owner asks whether the UI is reducing bloat where it matters. The panel should spend space on decision-making metadata, not prose.
