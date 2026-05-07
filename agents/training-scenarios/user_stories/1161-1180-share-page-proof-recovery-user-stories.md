# Share Page Browser Proof Recovery User Stories 1161-1180

Objective: the `/s` page must let users recover from a failed browser proof without rerunning the whole AI prompt, reading terminal logs, or applying unverified edits. This pass stays on the original product goal: autonomous website building should feel fast, honest, and operable from the website UI itself.

Strict success criteria for every story:

- The AI response is visible within 2.5 seconds in the mocked user-story test.
- Failed browser proof is marked as `Needs retry`.
- Pending edits remain blocked while proof is failed.
- A visible `Retry proof` action appears in the website UI.
- Retrying proof does not call the AI endpoint again.
- A successful retry changes the last-run state to `Completed`.
- The warning disappears and `Apply` becomes enabled only after successful browser evidence.
- The UI shows proof target, screenshot state, and issue count without exposing raw `hanasand-tool` tags.

## Stories

1161. A founder says, "the proof failed, now make the retry obvious." They should see one recovery action and not need to understand browser tooling.

1162. A designer says, "unblock only after real proof." They should not be allowed to apply a visual change until browser proof succeeds.

1163. A total newbie says, "what do I press now?" The failed state should lead them to `Retry proof`, not to a terminal-like explanation.

1164. A corporate reviewer wants evidence that the first proof failed and the second proof passed. The website UI should show both states through the run receipt and browser proof strip.

1165. An ops user says browser checks sometimes flake. The product should recover momentum through retry, not force a new prompt.

1166. An agency operator needs to apply work after proof recovers. Apply should unlock only after the retry passes.

1167. Support wants no terminal instructions for retry. The retry control must be visible in the pending-change panel.

1168. A founder refuses to rerun the entire prompt after a transient browser timeout. The UI should reuse the original proof target.

1169. An accessibility proof times out and then recovers. The recovered browser evidence should show viewport and issue status.

1170. A pricing page check fails once, then succeeds. The user should see `Completed` before they can apply.

1171. A mobile proof should recover inside the chat panel. The user should not need another tool or route.

1172. Compliance requires blocked-until-green proof. Failed proof blocks apply; successful proof unlocks it.

1173. An investor page should not require a second AI answer just to retry evidence. The retry action should call only browser proof.

1174. A restaurant owner asks what to click after a timeout. The answer should be an obvious UI action, not a paragraph.

1175. A user coming from terminal agents says failed tools lose them. Hanasand should preserve state and offer recovery.

1176. Another agent picks up the handoff. The retry result should be visible in the page, not hidden in history.

1177. A client asks, "can I apply now?" The answer should be represented by the enabled/disabled apply button.

1178. A designer wants no apply until a screenshot comes back. Screenshot state should be visible after retry.

1179. A beginner does not understand "failed proof." The UI should keep the message short and show the next action.

1180. Product owner asks whether this reduces friction without lying. The system should be faster by reusing the proof call and safer by keeping apply gated until proof succeeds.
