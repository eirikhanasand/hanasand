# Share Page Regression Accountability User Stories 1301-1320

These scenarios cover another recurring Reddit pattern around AI coding agents: they sometimes edit before reading, miss references, skip failing tests, hallucinate verification, lose context after compaction, or call the regression they introduced an unrelated existing issue. The share-page AI should treat those as product failures, not normal agent behavior.

## 1301. Partial env rename
As a developer, I want the agent to find all related environment variable references before editing, so it does not rename half the project and leave the rest broken.

Acceptance:
- The response names the invariant to preserve.
- The response prefers current-file evidence over guessing.
- The response treats missed references as a regression risk.

## 1302. Edit before read
As a reviewer, I want the agent to read current file content before changing it, so stale assumptions do not overwrite working code.

Acceptance:
- The response says what must be read first.
- The changed scope is explicit.
- The agent does not invent current file state.

## 1303. Existing issue excuse
As a product owner, I want the agent to compare against the current state before calling a bug pre-existing, so it remains accountable for regressions it introduced.

Acceptance:
- The response avoids blaming old state without evidence.
- It names the comparison needed.
- It keeps the regression attributable.

## 1304. Ignored tests
As a QA lead, I want failing tests treated as product signals, so the agent cannot skip or ignore tests just to report success.

Acceptance:
- Skipping tests is prohibited unless explicitly requested.
- The response names the failing check.
- Success requires real verification.

## 1305. Fake selector coverage
As a frontend engineer, I want tests to use real DOM selectors and user flows, so AI-generated selectors do not create fake coverage.

Acceptance:
- The response prefers real selectors.
- The response avoids claiming coverage from invented checks.
- Browser proof is requested for UI claims.

## 1306. Compaction change ledger
As an operator resuming a long agent run, I want a compact change ledger, so context loss does not hide what changed.

Acceptance:
- Changed files are listed.
- Verification state is listed.
- Unknowns remain visible after compaction.

## 1307. Worked before fix
As a non-technical user, I want the agent to respect that the site worked before its fix, so it diagnoses the introduced break instead of rebuilding everything.

Acceptance:
- The prior working behavior is preserved as an invariant.
- The response avoids broad rewrites.
- It seeks the smallest corrective patch.

## 1308. Visual regression
As a designer, I want visual regressions treated as real failures even when tests are green, so layout, spacing, and responsive behavior stay trustworthy.

Acceptance:
- Visual proof is requested.
- Green tests do not override visible breakage.
- The affected viewport or component is named.

## 1309. Refactor invariants
As a corporate reviewer, I want invariants preserved during refactors, so cleanup does not change production behavior.

Acceptance:
- The response names preserved behavior.
- The refactor scope stays bounded.
- Verification targets the invariant.

## 1310. YAML read first
As a platform engineer, I want config files read before edits, so indentation, anchors, env names, and deploy settings are not guessed.

Acceptance:
- Current YAML/config is treated as source of truth.
- The agent avoids speculative config rewrites.
- The verification plan includes config-sensitive checks.

## 1311. Real DOM verification
As support, I want the agent to verify against the real DOM, so it stops thrashing on imagined components.

Acceptance:
- The response requests real DOM or browser evidence.
- Selectors are grounded in the page.
- Repeated speculative attempts are avoided.

## 1312. Checkout broken
As an ecommerce client, I want checkout treated as an end-to-end invariant, so passing unit tests do not hide a broken buying flow.

Acceptance:
- Critical user journeys are preserved.
- Verification includes the user flow.
- The response names unverified payment risk.

## 1313. Inherited ignored tests
As an agency inheriting AI work, I want ignored tests surfaced, so hidden failures do not become my maintenance burden.

Acceptance:
- Ignored/skipped tests are called out.
- The response does not normalize hidden failures.
- Cleanup is tied to real test restoration.

## 1314. Changed file ledger
As a founder, I want a small ledger of changed files and why, so I can detect surprise edits quickly.

Acceptance:
- Files and reasons are explicit.
- Verification status is attached.
- Unrelated edits are excluded.

## 1315. No clobbering
As an operator, I want working code protected from clobbering, so the agent does not replace current behavior with a generic scaffold.

Acceptance:
- Existing working code is preserved.
- Replacement is justified file by file.
- The smallest safe patch is preferred.

## 1316. Consensus hallucination
As a QA reviewer, I want real tests over AI consensus, so multiple model opinions do not replace runtime evidence.

Acceptance:
- AI agreement is not treated as verification.
- Real test/browser/build output is required.
- Unknowns are named.

## 1317. Guessed dependencies
As a legacy service maintainer, I want dependency changes grounded in current files, so the agent does not break compatibility by guessing packages.

Acceptance:
- Existing dependency constraints are read first.
- Changes are minimal.
- Build/runtime verification is required.

## 1318. Out-of-scope mobile regression
As a mobile user, I want regressions introduced by the agent to remain in scope, so mobile breakage is not dismissed as unrelated.

Acceptance:
- Mobile regression evidence is accepted.
- The response avoids scope excuses.
- The affected viewport is verified.

## 1319. Real tests not predicted success
As a technical lead, I want real tests instead of predicted success, so the agent cannot say "should work" as a substitute for verification.

Acceptance:
- The response distinguishes predicted success from verified success.
- Verification commands or browser checks are named.
- Missing verification is admitted.

## 1320. Real-world enough
As the product owner of Hanasand, I want regression-accountability scenarios to match real-world AI coding complaints, so the share-page AI becomes a better autonomous builder rather than a faster source of hidden breakage.

Acceptance:
- The suite covers reading before editing, skipped tests, fake coverage, context loss, visual regressions, and attribution.
- It keeps responses concise.
- It improves accountability without making the agent timid.
