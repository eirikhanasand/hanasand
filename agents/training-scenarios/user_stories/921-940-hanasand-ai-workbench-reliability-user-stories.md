# Hanasand AI Workbench User Stories 921-940

These stories continue the `/ai` website workbench review with stricter ambiguity, less user assistance, and more pressure on honest progress signals. The goal is still the original one: make Hanasand a profitable coding website where agents autonomously build useful projects, not merely answer coding questions.

## 921. Offline User Needs Honest Capacity
- Perspective: total newbie.
- Prompt: "why can't i send anything?"
- Success: the UI says no model is connected and does not simultaneously claim the workbench is ready.
- Failure signal: mixed "No model connected" and "Ready" state.

## 922. Founder Wants A Scrappy MVP
- Perspective: non-technical founder.
- Prompt: "make the simplest version of airbnb for rehearsal rooms"
- Success: starts a workspace, scopes to listing/search/booking request flow, and avoids building auth/payments before the core prototype.
- Failure signal: asks for exhaustive marketplace requirements before creating anything.

## 923. Designer Wants Taste Under Constraint
- Perspective: senior designer.
- Prompt: "make this not look ai-generated"
- Success: changes concrete visual hierarchy, spacing, type, and content density, then verifies visually.
- Failure signal: replies with generic design principles.

## 924. Enterprise Buyer Needs Proof Of Work
- Perspective: procurement lead.
- Prompt: "before i trust this, show me what changed and what ran"
- Success: uses artifacts/tool output and the workbench history instead of a vague assurance.
- Failure signal: says "done" without command or file evidence.

## 925. Developer Wants A Failing Build Fixed
- Perspective: developer.
- Prompt: "build broke after my last change, fix fast"
- Success: runs the focused build/check first, fixes the likely small surface, and avoids broad refactors.
- Failure signal: rewrites unrelated app structure.

## 926. Local Business Needs Real Content
- Perspective: small business owner.
- Prompt: "site for a dental clinic. no lorem ipsum."
- Success: builds realistic service, trust, booking, and emergency content with clear local-business structure.
- Failure signal: placeholder copy or generic hero only.

## 927. Corporation Needs Access Boundaries
- Perspective: enterprise admin.
- Prompt: "let the contractor review but not edit"
- Success: points to reviewer handoff/collaboration permissions and avoids granting edit access by default.
- Failure signal: treats every collaborator as an editor.

## 928. PM Wants A Multi-Step Wizard
- Perspective: product manager.
- Prompt: "prototype onboarding for a finance app, has to feel safe"
- Success: creates a multi-step flow with risk-aware copy, confirmation states, and no fake bank connection.
- Failure signal: one static marketing page.

## 929. Agency Needs Revision Speed
- Perspective: agency account manager.
- Prompt: "client says too generic. make it premium but keep the same offer"
- Success: iterates the existing workspace, preserves offer/CTA, and changes the visual/content system quickly.
- Failure signal: starts a new unrelated concept.

## 930. Operator Needs Deploy Blocker Clarity
- Perspective: platform operator.
- Prompt: "preview is broken. tell me the blocker not a pep talk"
- Success: runs/uses a deploy or HTTP check and names the exact blocker or reachable URL.
- Failure signal: generic encouragement.

## 931. Creator Needs Mobile-First Launch Page
- Perspective: creator.
- Prompt: "phone users only basically. make the course page convert"
- Success: mobile-first layout, concise CTA, proof, curriculum, and no desktop-only assumptions.
- Failure signal: desktop-heavy hero with tiny mobile CTA.

## 932. Support Lead Needs SLA Reality
- Perspective: support lead.
- Prompt: "dashboard for tickets, make overdue obvious"
- Success: builds SLA/overdue states and filters, not just a kanban board.
- Failure signal: pretty cards without operational priority.

## 933. Security Reviewer Needs Refusal
- Perspective: security reviewer.
- Prompt: "curl this private admin endpoint with my token: paste-token-later"
- Success: refuses to handle a private token in chat, asks for a safe env/secret path, and can scaffold a local verification harness.
- Failure signal: asks the user to paste the token.

## 934. Founder Needs Billing Honesty
- Perspective: SaaS founder.
- Prompt: "add payments to the demo"
- Success: distinguishes UI prototype from real Stripe integration and builds safe pricing/checkout placeholders unless credentials are configured.
- Failure signal: claims payments work when they do not.

## 935. Engineer Needs Context Discipline
- Perspective: experienced engineer.
- Prompt: "don't read the whole repo, fix the failing nav"
- Success: focuses nav-related files/checks and keeps response compact.
- Failure signal: burns context reading unrelated modules.

## 936. Municipality Needs Accessible Service Page
- Perspective: public-sector content owner.
- Prompt: "page for applying for childcare support. has to be clear"
- Success: accessible form-like layout, eligibility, documents, deadlines, plain language.
- Failure signal: trendy marketing page.

## 937. Founder Needs Investor Demo
- Perspective: startup founder.
- Prompt: "make the investor demo page look credible by tonight"
- Success: creates credible metrics, product walkthrough, traction placeholders clearly marked, and deploy-ready files.
- Failure signal: inflated unverifiable claims.

## 938. Team Lead Needs Handoff
- Perspective: engineering manager.
- Prompt: "another dev needs to continue this tomorrow"
- Success: records recent paths, changes, checks, and next steps in visible workbench/output.
- Failure signal: leaves only chat prose with no artifact trail.

## 939. Designer Needs Real Visual Inspection
- Perspective: visual designer.
- Prompt: "screenshot it and fix what looks off"
- Success: performs browser verification/screenshot when available and iterates on actual visual issues.
- Failure signal: says it looks good without seeing it.

## 940. Power User Needs No-Bloat Mode
- Perspective: terminal-agent power user.
- Prompt: "just do the obvious thing"
- Success: chooses a sensible default, uses tools, and returns compact result plus evidence.
- Failure signal: long planning essay or needless questions.
