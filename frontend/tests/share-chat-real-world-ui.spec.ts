import { expect, test, type BrowserContext } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

type AppStory = {
    id: number
    prompt: string
    expected: string
}

const stories: AppStory[] = [
    { id: 801, prompt: 'Make this a retainer page, but keep boundaries obvious. No payment stuff.', expected: 'retainer' },
    { id: 802, prompt: 'I clean houses. Make page practical. No booking.', expected: 'cleaning' },
    { id: 803, prompt: 'Access request info, no passwords, approvals clear.', expected: 'access' },
    { id: 804, prompt: 'Refund policy page. Fair, no dark patterns.', expected: 'refund' },
    { id: 805, prompt: 'Minor outage page. Calm, status, affected stuff, cadence.', expected: 'incident' },
    { id: 806, prompt: 'Proofing info. Review process, timeline, no gallery.', expected: 'proofing' },
    { id: 807, prompt: 'Volunteer page, roles, time, training. Don\'t pretend signup works.', expected: 'volunteer' },
    { id: 808, prompt: 'Budget review page. Careful boundaries. No advice.', expected: 'budget' },
    { id: 809, prompt: 'Audit prep, calm checklist, no upload portal.', expected: 'audit' },
    { id: 810, prompt: 'Waitlist page. No patient details.', expected: 'waitlist' },
    { id: 811, prompt: 'Partner onboarding page. Steps and docs. No upload.', expected: 'partner' },
    { id: 812, prompt: 'Procurement help page. Make it less corporate.', expected: 'procurement' },
    { id: 813, prompt: 'Beta feedback page. Useful feedback, what not to send, privacy.', expected: 'feedback' },
    { id: 814, prompt: 'Repair request info, emergency caveat, no login.', expected: 'repair' },
    { id: 815, prompt: 'Workshop page. What to bring, accessibility, no tickets.', expected: 'workshop' },
    { id: 816, prompt: 'Warranty page with exclusions and proof needed.', expected: 'warranty' },
    { id: 817, prompt: 'Migration page. Reassuring, risks, checklist, no login.', expected: 'migration' },
    { id: 818, prompt: 'Catering page, menus, lead time, quote path. No checkout.', expected: 'catering' },
    { id: 819, prompt: 'Legal intake page. Warnings, conflict caveat, no legal advice.', expected: 'legal' },
    { id: 820, prompt: 'Client handoff page. Deliverables, limits, maintenance, no dashboard.', expected: 'handoff' },
]

const transparencyStories: AppStory[] = [
    { id: 821, prompt: 'Make a launch page. I need to see changes before they land.', expected: 'launch' },
    { id: 822, prompt: 'Turn this into a tasteful services page, but show me what file changed.', expected: 'services' },
    { id: 823, prompt: 'Make this an incident notes page. Tell me what context you used.', expected: 'incident' },
    { id: 824, prompt: 'Make a page for my tutoring thing.', expected: 'tutoring' },
    { id: 825, prompt: 'Access request instructions. No secrets.', expected: 'access' },
    { id: 826, prompt: 'Warranty page. Conditions and proof. Short.', expected: 'warranty' },
    { id: 827, prompt: 'Deletion request page. No personal details.', expected: 'deletion' },
    { id: 828, prompt: 'Page for repair requests. No login.', expected: 'repair' },
    { id: 829, prompt: 'Beta feedback page. Privacy, what helps, what not to send.', expected: 'feedback' },
    { id: 830, prompt: 'Handoff page. Deliverables, limits, maintenance. No dashboard.', expected: 'handoff' },
    { id: 831, prompt: 'Budget review page. No financial advice.', expected: 'budget' },
    { id: 832, prompt: 'Waitlist page. Updates and timing, no patient info.', expected: 'waitlist' },
    { id: 833, prompt: 'Procurement help, less corporate, docs and timeline.', expected: 'procurement' },
    { id: 834, prompt: 'Visit prep page. Access, safety, timing. No booking.', expected: 'visit' },
    { id: 835, prompt: 'Volunteer page. Roles and time commitment.', expected: 'volunteer' },
    { id: 836, prompt: 'Catering page. Lead time, dietary caveat, no checkout.', expected: 'catering' },
    { id: 837, prompt: 'Proofing instructions. Feedback, timeline, usage caveat.', expected: 'proofing' },
    { id: 838, prompt: 'Migration page. Checklist and risks, reassuring.', expected: 'migration' },
    { id: 839, prompt: 'Intake page. Conflict caveat, no legal advice.', expected: 'legal' },
    { id: 840, prompt: 'Workshop page. What to bring and accessibility.', expected: 'workshop' },
]

const speedReviewStories: AppStory[] = [
    { id: 841, prompt: 'Make this not embarrassing for a studio.', expected: 'studio' },
    { id: 842, prompt: 'Make it sound real, but don\'t overpromise.', expected: 'positioning' },
    { id: 843, prompt: 'Procurement page. Safer, shorter, no portal.', expected: 'procurement' },
    { id: 844, prompt: 'Make handoff clearer. Mention limits.', expected: 'handoff' },
    { id: 845, prompt: 'I need a simple page for my class.', expected: 'class' },
    { id: 846, prompt: 'Outage note. Calm. No fake status.', expected: 'outage' },
    { id: 847, prompt: 'Waitlist info, but don\'t collect health stuff.', expected: 'waitlist' },
    { id: 848, prompt: 'Catering page. Keep allergy wording careful.', expected: 'catering' },
    { id: 849, prompt: 'Access page. No passwords. Make approvals clear.', expected: 'access' },
    { id: 850, prompt: 'Volunteers. Roles, shifts, training. Keep it honest.', expected: 'volunteers' },
    { id: 851, prompt: 'Proofing page. Feedback rules and usage caveat.', expected: 'proofing' },
    { id: 852, prompt: 'Visit prep. Access, timing, safety. No booking.', expected: 'visit' },
    { id: 853, prompt: 'Budget review. Useful, not financial advice.', expected: 'budget' },
    { id: 854, prompt: 'Feedback page. Tell people what helps.', expected: 'feedback' },
    { id: 855, prompt: 'Repair request info. Emergencies separate.', expected: 'repair' },
    { id: 856, prompt: 'Intake page. Conflict check. No advice.', expected: 'intake' },
    { id: 857, prompt: 'Workshop page. Bring-list and accessibility.', expected: 'workshop' },
    { id: 858, prompt: 'Migration page. Checklist, risks, reassuring.', expected: 'migration' },
    { id: 859, prompt: 'Warranty page. Proof, exclusions, next steps.', expected: 'warranty' },
    { id: 860, prompt: 'Audit prep page. Checklist only. No upload.', expected: 'audit' },
]

const toolFrictionStories: AppStory[] = [
    { id: 861, prompt: 'make it investor safe but not cringe', expected: 'investor' },
    { id: 862, prompt: 'idk, customer dashboard vibes, but just the page', expected: 'dashboard' },
    { id: 863, prompt: 'my boss wants proof we know what changed', expected: 'change-log' },
    { id: 864, prompt: 'agency client is picky. make first screen better.', expected: 'agency' },
    { id: 865, prompt: 'newbie mode: I sell plants, make the site useful', expected: 'plants' },
    { id: 866, prompt: 'corporate procurement hates fluff. fix it.', expected: 'procurement' },
    { id: 867, prompt: 'designer asked for taste, founder asked for speed', expected: 'studio-brief' },
    { id: 868, prompt: 'the page feels scammy. remove risky promises.', expected: 'trust' },
    { id: 869, prompt: 'make support page less annoying, no ticket system', expected: 'support' },
    { id: 870, prompt: 'compliance will read this, keep claims boring', expected: 'compliance' },
    { id: 871, prompt: 'turn this into a local gym page, no fake booking', expected: 'gym' },
    { id: 872, prompt: 'we need release notes customers can understand', expected: 'release-notes' },
    { id: 873, prompt: 'make a contractor handoff thing, but quick', expected: 'contractor' },
    { id: 874, prompt: 'finance team asked for cost page. careful wording.', expected: 'costs' },
    { id: 875, prompt: 'school club page, make parents trust it', expected: 'school-club' },
    { id: 876, prompt: 'sales overpromised. make this honest.', expected: 'honest-sales' },
    { id: 877, prompt: 'ops needs a checklist, not a novel', expected: 'ops-checklist' },
    { id: 878, prompt: 'restaurant site, allergies careful, no orders', expected: 'restaurant' },
    { id: 879, prompt: 'make security review page from nothing', expected: 'security-review' },
    { id: 880, prompt: 'the user is lost. show what happens next.', expected: 'next-steps' },
]

const contextBudgetStories: AppStory[] = [
    { id: 881, prompt: 'this is too much, make the page obvious', expected: 'obvious' },
    { id: 882, prompt: 'client asked "more premium" and left', expected: 'premium' },
    { id: 883, prompt: 'small clinic, but dont collect anything weird', expected: 'clinic' },
    { id: 884, prompt: 'enterprise buyer skim only, make it survive', expected: 'enterprise-skim' },
    { id: 885, prompt: 'my cousin needs a portfolio by tonight', expected: 'portfolio' },
    { id: 886, prompt: 'make the home page stop wasting words', expected: 'concise-home' },
    { id: 887, prompt: 'founder is panicking, calm landing page', expected: 'calm-launch' },
    { id: 888, prompt: 'we got burned by hidden changes before', expected: 'visible-changes' },
    { id: 889, prompt: 'nonprofit page, honest ask, no fake donate', expected: 'nonprofit' },
    { id: 890, prompt: 'security vendor page. no badges we dont have', expected: 'vendor-security' },
    { id: 891, prompt: 'make it clear what I do. I fix bikes.', expected: 'bike-repair' },
    { id: 892, prompt: 'law office but careful, no advice', expected: 'law-office' },
    { id: 893, prompt: 'architect site. designer will judge it.', expected: 'architect' },
    { id: 894, prompt: 'ops wants proof, users want simple', expected: 'ops-proof' },
    { id: 895, prompt: 'make it good for a boring B2B thing', expected: 'b2b' },
    { id: 896, prompt: 'course page. no fake enrollment.', expected: 'course' },
    { id: 897, prompt: 'pricing page but we dont know prices yet', expected: 'pricing' },
    { id: 898, prompt: 'status page copy, no fake uptime', expected: 'status-copy' },
    { id: 899, prompt: 'portfolio for a photographer, no gallery backend', expected: 'photographer' },
    { id: 900, prompt: 'make next step dead obvious for a total beginner', expected: 'beginner-next-step' },
]

const shareBrowserEvidenceStories: AppStory[] = [
    { id: 1021, prompt: 'does this look live or am i kidding myself', expected: 'live-proof' },
    { id: 1022, prompt: 'designer says first screen feels wrong, look at it', expected: 'first-screen' },
    { id: 1023, prompt: 'newbie asks where contact is', expected: 'contact-path' },
    { id: 1024, prompt: 'corporate buyer needs pricing obvious but not fake', expected: 'pricing-proof' },
    { id: 1025, prompt: 'phone users complain, dont just lint', expected: 'mobile-proof' },
    { id: 1026, prompt: 'agency client wants proof before applying anything', expected: 'proof-before-apply' },
    { id: 1027, prompt: 'public sector page, screen reader basics first', expected: 'accessibility-proof' },
    { id: 1028, prompt: 'founder says it feels scammy, check visible claims', expected: 'trust-proof' },
    { id: 1029, prompt: 'restaurant owner wants booking but no fake booking', expected: 'booking-proof' },
    { id: 1030, prompt: 'ops asks what changed and whether it is visible', expected: 'ops-visible-proof' },
    { id: 1031, prompt: 'investor link goes out today, verify the page surface', expected: 'investor-proof' },
    { id: 1032, prompt: 'compliance wants docs visible without upload portal', expected: 'docs-proof' },
    { id: 1033, prompt: 'user says blank page, dont reassure me', expected: 'blank-proof' },
    { id: 1034, prompt: 'total beginner needs next step obvious', expected: 'next-step-proof' },
    { id: 1035, prompt: 'designer asked for less generic copy, inspect headings', expected: 'copy-proof' },
    { id: 1036, prompt: 'support page is annoying, check buttons and forms', expected: 'support-proof' },
    { id: 1037, prompt: 'sales overpromised, show visible proof and caveats', expected: 'claims-proof' },
    { id: 1038, prompt: 'another agent will continue this, make evidence visible', expected: 'handoff-proof' },
    { id: 1039, prompt: 'codex terminal hides too much, prove the ui is better', expected: 'terminal-contrast-proof' },
    { id: 1040, prompt: 'are we still building the best autonomous website builder', expected: 'drift-proof' },
]

const shareEvidenceTargetStories: AppStory[] = [
    { id: 1041, prompt: 'look at the actual page, not a sample site', expected: 'actual-page' },
    { id: 1042, prompt: 'client says preview is broken, use the right link', expected: 'right-link' },
    { id: 1043, prompt: 'newbie says where am i supposed to click', expected: 'current-share-clicks' },
    { id: 1044, prompt: 'designer says inspect the page i am on', expected: 'current-page-design' },
    { id: 1045, prompt: 'corporate review wants proof from this share', expected: 'share-proof' },
    { id: 1046, prompt: 'do not hallucinate the preview url', expected: 'no-hallucinated-url' },
    { id: 1047, prompt: 'support says blank page on this exact share', expected: 'exact-share-blank' },
    { id: 1048, prompt: 'ops wants evidence attached to this workspace', expected: 'workspace-evidence' },
    { id: 1049, prompt: 'agency handoff needs the visible share url', expected: 'handoff-url' },
    { id: 1050, prompt: 'pricing needs proof from our page', expected: 'our-pricing-proof' },
    { id: 1051, prompt: 'mobile complaint is about this share only', expected: 'share-mobile-proof' },
    { id: 1052, prompt: 'accessibility pass on the current page', expected: 'current-accessibility' },
    { id: 1053, prompt: 'investor opens the share link today', expected: 'investor-share-link' },
    { id: 1054, prompt: 'compliance asks what public users see here', expected: 'public-share-compliance' },
    { id: 1055, prompt: 'restaurant owner says booking is hidden here', expected: 'booking-current-share' },
    { id: 1056, prompt: 'founder says it looks scammy here', expected: 'claims-current-share' },
    { id: 1057, prompt: 'another agent must continue from this url', expected: 'handoff-current-url' },
    { id: 1058, prompt: 'terminal agents lose the page context, dont', expected: 'terminal-context-proof' },
    { id: 1059, prompt: 'prove this is still about shipping websites', expected: 'shipping-proof' },
    { id: 1060, prompt: 'ambiguous: fix the thing users see', expected: 'visible-thing' },
]

const visibleProofTargetStories: AppStory[] = [
    { id: 1061, prompt: 'wait, what page are you checking', expected: 'visible-target' },
    { id: 1062, prompt: 'designer wants to know the exact inspected page', expected: 'designer-visible-target' },
    { id: 1063, prompt: 'newbie needs the link shown before sending', expected: 'newbie-visible-link' },
    { id: 1064, prompt: 'corporate reviewer asks for source of proof', expected: 'corporate-proof-source' },
    { id: 1065, prompt: 'ops says do not hide the target in logs', expected: 'ops-visible-target' },
    { id: 1066, prompt: 'agency client wants the page url in the ui', expected: 'agency-visible-url' },
    { id: 1067, prompt: 'support wants to avoid checking the wrong share', expected: 'support-right-share' },
    { id: 1068, prompt: 'founder is worried about hallucinated browser checks', expected: 'founder-proof-target' },
    { id: 1069, prompt: 'accessibility reviewer needs target before proof', expected: 'a11y-target-visible' },
    { id: 1070, prompt: 'pricing proof must show which page was read', expected: 'pricing-target-visible' },
    { id: 1071, prompt: 'mobile bug is only on this share', expected: 'mobile-target-visible' },
    { id: 1072, prompt: 'compliance asks for evidence source', expected: 'compliance-source' },
    { id: 1073, prompt: 'investor handoff needs visible page source', expected: 'investor-source' },
    { id: 1074, prompt: 'restaurant owner asks what page you inspected', expected: 'restaurant-source' },
    { id: 1075, prompt: 'terminal agents hide too much state', expected: 'terminal-state-visible' },
    { id: 1076, prompt: 'another agent should not guess the url', expected: 'handoff-no-guess' },
    { id: 1077, prompt: 'client says prove the exact thing users see', expected: 'exact-visible-proof' },
    { id: 1078, prompt: 'designer says no hidden context please', expected: 'designer-no-hidden-context' },
    { id: 1079, prompt: 'beginner asks why proof is trustworthy', expected: 'beginner-trust' },
    { id: 1080, prompt: 'are we still reducing token bloat', expected: 'target-reduces-bloat' },
]

const evidenceSummaryStories: AppStory[] = [
    { id: 1081, prompt: 'looks broken, show me fast', expected: 'broken-fast-proof' },
    { id: 1082, prompt: 'designer says the top feels off', expected: 'designer-scan-proof' },
    { id: 1083, prompt: 'newbie asks if it is safe to trust', expected: 'newbie-proof-summary' },
    { id: 1084, prompt: 'corporate reviewer needs issue count now', expected: 'corporate-issue-count' },
    { id: 1085, prompt: 'mobile complaint, dont make me read logs', expected: 'mobile-no-logs' },
    { id: 1086, prompt: 'agency client wants screenshot status visible', expected: 'agency-screenshot-state' },
    { id: 1087, prompt: 'ops says prove which page failed', expected: 'ops-failed-url' },
    { id: 1088, prompt: 'investor link is live soon, no essays', expected: 'investor-compact-proof' },
    { id: 1089, prompt: 'accessibility concern, show evidence status', expected: 'a11y-evidence-status' },
    { id: 1090, prompt: 'pricing page might be wrong', expected: 'pricing-proof-strip' },
    { id: 1091, prompt: 'support needs the proof title visible', expected: 'support-proof-title' },
    { id: 1092, prompt: 'founder hates terminal scrollback', expected: 'founder-no-scrollback' },
    { id: 1093, prompt: 'restaurant owner asks what browser saw', expected: 'restaurant-browser-saw' },
    { id: 1094, prompt: 'compliance wants errors before edits', expected: 'compliance-errors-first' },
    { id: 1095, prompt: 'designer asks if screenshot happened', expected: 'designer-screenshot-proof' },
    { id: 1096, prompt: 'total beginner says just tell me if it worked', expected: 'beginner-worked-proof' },
    { id: 1097, prompt: 'another agent continues after me', expected: 'handoff-proof-strip' },
    { id: 1098, prompt: 'sales page looks scammy, verify visible claims', expected: 'sales-claims-proof' },
    { id: 1099, prompt: 'public sector buyer needs quick audit surface', expected: 'public-sector-proof' },
    { id: 1100, prompt: 'are we drifting or shipping useful websites', expected: 'shipping-drift-proof' },
]

const runSummaryStories: AppStory[] = [
    { id: 1101, prompt: 'did it actually do anything fast', expected: 'fast-run-proof' },
    { id: 1102, prompt: 'designer wants speed, not a wall of text', expected: 'designer-speed-proof' },
    { id: 1103, prompt: 'newbie asks what happened just now', expected: 'newbie-run-summary' },
    { id: 1104, prompt: 'corporate reviewer needs bounded output', expected: 'corporate-token-cap' },
    { id: 1105, prompt: 'ops wants tool count without logs', expected: 'ops-tool-count' },
    { id: 1106, prompt: 'agency client says prove progress', expected: 'agency-progress-proof' },
    { id: 1107, prompt: 'support asks whether browser ran', expected: 'support-browser-count' },
    { id: 1108, prompt: 'founder asks if it just rambled', expected: 'founder-no-ramble' },
    { id: 1109, prompt: 'accessibility reviewer wants concise evidence', expected: 'a11y-compact-run' },
    { id: 1110, prompt: 'pricing page check, keep token budget visible', expected: 'pricing-budget-visible' },
    { id: 1111, prompt: 'mobile bug, show run result quickly', expected: 'mobile-run-result' },
    { id: 1112, prompt: 'compliance needs retry state if failed', expected: 'compliance-retry-state' },
    { id: 1113, prompt: 'investor handoff asks how long it took', expected: 'investor-duration' },
    { id: 1114, prompt: 'restaurant owner says just show progress', expected: 'restaurant-progress' },
    { id: 1115, prompt: 'terminal tools hide duration', expected: 'terminal-duration-visible' },
    { id: 1116, prompt: 'another agent needs a run receipt', expected: 'handoff-run-receipt' },
    { id: 1117, prompt: 'client asks how many edits are pending', expected: 'client-edit-count' },
    { id: 1118, prompt: 'designer says less narration', expected: 'designer-less-narration' },
    { id: 1119, prompt: 'beginner asks whether it finished', expected: 'beginner-completed-state' },
    { id: 1120, prompt: 'are we still optimizing for real users', expected: 'real-user-run-proof' },
]

const browserRetryStories: AppStory[] = [
    { id: 1121, prompt: 'browser proof failed but dont lie', expected: 'browser-failed-honestly' },
    { id: 1122, prompt: 'designer needs to know proof did not complete', expected: 'designer-proof-retry' },
    { id: 1123, prompt: 'newbie asks did the check work', expected: 'newbie-check-failed' },
    { id: 1124, prompt: 'corporate reviewer says failed proof must be visible', expected: 'corporate-failed-proof' },
    { id: 1125, prompt: 'ops wants retry state when browser flakes', expected: 'ops-retry-state' },
    { id: 1126, prompt: 'agency client should not see false completed', expected: 'agency-no-false-complete' },
    { id: 1127, prompt: 'support asks if the browser tool timed out', expected: 'support-browser-timeout' },
    { id: 1128, prompt: 'founder says stop pretending it worked', expected: 'founder-honest-failure' },
    { id: 1129, prompt: 'accessibility proof failed, no claims', expected: 'a11y-no-claim' },
    { id: 1130, prompt: 'pricing proof failed, mark retry', expected: 'pricing-retry-visible' },
    { id: 1131, prompt: 'mobile proof did not load', expected: 'mobile-proof-retry' },
    { id: 1132, prompt: 'compliance needs failure visible before apply', expected: 'compliance-failure-visible' },
    { id: 1133, prompt: 'investor page check errored', expected: 'investor-check-error' },
    { id: 1134, prompt: 'restaurant booking proof failed', expected: 'restaurant-proof-failed' },
    { id: 1135, prompt: 'terminal tools hide failed checks', expected: 'terminal-failure-visible' },
    { id: 1136, prompt: 'another agent needs to see retry needed', expected: 'handoff-retry-needed' },
    { id: 1137, prompt: 'client asks if proof is reliable', expected: 'client-proof-unreliable' },
    { id: 1138, prompt: 'designer says no green check if proof failed', expected: 'designer-no-green-check' },
    { id: 1139, prompt: 'beginner asks what to do next after failure', expected: 'beginner-retry-next' },
    { id: 1140, prompt: 'are we still honest enough for production', expected: 'production-honesty' },
]

const proofGateStories: AppStory[] = [
    { id: 1141, prompt: 'dont let me apply if proof failed', expected: 'apply-blocked-after-proof-fail' },
    { id: 1142, prompt: 'designer says no unverified apply', expected: 'designer-no-unverified-apply' },
    { id: 1143, prompt: 'newbie might click apply anyway', expected: 'newbie-apply-guard' },
    { id: 1144, prompt: 'corporate reviewer requires evidence gate', expected: 'corporate-evidence-gate' },
    { id: 1145, prompt: 'ops wants failed checks to block release', expected: 'ops-release-block' },
    { id: 1146, prompt: 'agency client must not ship failed proof', expected: 'agency-proof-gate' },
    { id: 1147, prompt: 'support says apply button is dangerous here', expected: 'support-apply-danger' },
    { id: 1148, prompt: 'founder says prevent accidental bad deploy', expected: 'founder-accidental-deploy' },
    { id: 1149, prompt: 'accessibility proof failed, block apply', expected: 'a11y-apply-block' },
    { id: 1150, prompt: 'pricing check failed, dont let apply through', expected: 'pricing-apply-block' },
    { id: 1151, prompt: 'mobile proof failed, require retry first', expected: 'mobile-retry-first' },
    { id: 1152, prompt: 'compliance needs a hard gate before apply', expected: 'compliance-hard-gate' },
    { id: 1153, prompt: 'investor page proof failed, no apply', expected: 'investor-no-apply' },
    { id: 1154, prompt: 'restaurant booking proof failed, stop apply', expected: 'restaurant-stop-apply' },
    { id: 1155, prompt: 'terminal agents let me miss failed proof', expected: 'terminal-proof-gate' },
    { id: 1156, prompt: 'handoff should show apply is blocked', expected: 'handoff-apply-blocked' },
    { id: 1157, prompt: 'client says do not ship unverified work', expected: 'client-unverified-block' },
    { id: 1158, prompt: 'designer needs retry before visual apply', expected: 'designer-visual-retry' },
    { id: 1159, prompt: 'beginner needs obvious retry first', expected: 'beginner-obvious-retry' },
    { id: 1160, prompt: 'are we still making this production safe', expected: 'production-safe-gate' },
]

const proofRecoveryStories: AppStory[] = [
    { id: 1161, prompt: 'the proof failed, now make the retry obvious', expected: 'retry-proof-action' },
    { id: 1162, prompt: 'designer says unblock only after real proof', expected: 'designer-proof-unlocks' },
    { id: 1163, prompt: 'newbie needs one button to recover', expected: 'newbie-one-button-retry' },
    { id: 1164, prompt: 'corporate reviewer wants failed then passed evidence', expected: 'corporate-proof-recovery' },
    { id: 1165, prompt: 'ops says browser flakes should not kill momentum', expected: 'ops-flaky-recovery' },
    { id: 1166, prompt: 'agency client needs apply after retry succeeds', expected: 'agency-retry-apply' },
    { id: 1167, prompt: 'support wants no terminal instructions for retry', expected: 'support-visible-retry' },
    { id: 1168, prompt: 'founder says do not make me rerun the whole prompt', expected: 'founder-no-rerun-prompt' },
    { id: 1169, prompt: 'accessibility proof timed out then recovered', expected: 'a11y-proof-recovered' },
    { id: 1170, prompt: 'pricing check retry passed, allow apply', expected: 'pricing-retry-passed' },
    { id: 1171, prompt: 'mobile proof should recover inside the panel', expected: 'mobile-panel-recovery' },
    { id: 1172, prompt: 'compliance needs blocked until green proof', expected: 'compliance-green-proof' },
    { id: 1173, prompt: 'investor page should not need a second AI answer', expected: 'investor-no-second-answer' },
    { id: 1174, prompt: 'restaurant owner asks what to click after timeout', expected: 'restaurant-timeout-click' },
    { id: 1175, prompt: 'terminal agents lose me after a failed tool', expected: 'terminal-failure-recovery' },
    { id: 1176, prompt: 'handoff needs proof retry result visible', expected: 'handoff-retry-result' },
    { id: 1177, prompt: 'client asks can I apply now after retry', expected: 'client-apply-after-retry' },
    { id: 1178, prompt: 'designer wants no apply until screenshot comes back', expected: 'designer-screenshot-unlock' },
    { id: 1179, prompt: 'beginner says I dont understand failed proof', expected: 'beginner-failed-proof-flow' },
    { id: 1180, prompt: 'are we still removing friction without lying', expected: 'production-recovery-truth' },
]

const pendingCheckpointStories: AppStory[] = [
    { id: 1181, prompt: 'dont lose the edit if I type another thing', expected: 'pending-checkpoint' },
    { id: 1182, prompt: 'designer wants review before next request', expected: 'designer-review-first' },
    { id: 1183, prompt: 'newbie will keep typing instead of applying', expected: 'newbie-apply-or-discard' },
    { id: 1184, prompt: 'corporate reviewer needs no hidden overwrite', expected: 'corporate-no-overwrite' },
    { id: 1185, prompt: 'ops says pending work should be a checkpoint', expected: 'ops-checkpoint' },
    { id: 1186, prompt: 'agency client changes mind mid-review', expected: 'agency-discard-path' },
    { id: 1187, prompt: 'support says users lose pending diffs', expected: 'support-pending-diff' },
    { id: 1188, prompt: 'founder keeps sending rapid followups', expected: 'founder-followup-guard' },
    { id: 1189, prompt: 'accessibility reviewer wants no accidental replace', expected: 'a11y-no-replace' },
    { id: 1190, prompt: 'pricing edit is ready but user asks more', expected: 'pricing-checkpoint' },
    { id: 1191, prompt: 'mobile review pending then another request', expected: 'mobile-pending-guard' },
    { id: 1192, prompt: 'compliance needs explicit discard', expected: 'compliance-discard' },
    { id: 1193, prompt: 'investor page ready, dont clobber it', expected: 'investor-no-clobber' },
    { id: 1194, prompt: 'restaurant owner types twice by mistake', expected: 'restaurant-double-send' },
    { id: 1195, prompt: 'terminal agents make pending state too easy to miss', expected: 'terminal-pending-visible' },
    { id: 1196, prompt: 'handoff agent needs one clear checkpoint', expected: 'handoff-checkpoint' },
    { id: 1197, prompt: 'client asks how to start over safely', expected: 'client-safe-startover' },
    { id: 1198, prompt: 'designer rejects the draft and wants another', expected: 'designer-discard-draft' },
    { id: 1199, prompt: 'beginner says I dont want that change', expected: 'beginner-discard-change' },
    { id: 1200, prompt: 'are we still prioritizing safe fast progress', expected: 'safe-fast-progress' },
]

const pendingSummaryStories: AppStory[] = [
    { id: 1201, prompt: 'what changed, dont make me read code first', expected: 'change-summary' },
    { id: 1202, prompt: 'designer wants a quick file summary', expected: 'designer-file-summary' },
    { id: 1203, prompt: 'newbie asks is this a new file', expected: 'newbie-new-file' },
    { id: 1204, prompt: 'corporate reviewer needs line counts', expected: 'corporate-line-counts' },
    { id: 1205, prompt: 'ops wants added removed visible', expected: 'ops-added-removed' },
    { id: 1206, prompt: 'agency client hates raw diffs first', expected: 'agency-diff-summary' },
    { id: 1207, prompt: 'support says pending diffs look scary', expected: 'support-friendly-diff' },
    { id: 1208, prompt: 'founder skims before demo', expected: 'founder-skim-summary' },
    { id: 1209, prompt: 'accessibility reviewer wants file scope fast', expected: 'a11y-file-scope' },
    { id: 1210, prompt: 'pricing change needs compact evidence', expected: 'pricing-compact-change' },
    { id: 1211, prompt: 'mobile fix ready, show size', expected: 'mobile-change-size' },
    { id: 1212, prompt: 'compliance wants no mystery patch', expected: 'compliance-no-mystery' },
    { id: 1213, prompt: 'investor page diff needs quick read', expected: 'investor-quick-diff' },
    { id: 1214, prompt: 'restaurant owner doesnt know diff syntax', expected: 'restaurant-no-diff-syntax' },
    { id: 1215, prompt: 'terminal agents dump walls of patch', expected: 'terminal-patch-summary' },
    { id: 1216, prompt: 'handoff needs changed file summary', expected: 'handoff-file-summary' },
    { id: 1217, prompt: 'client asks how big the change is', expected: 'client-change-size' },
    { id: 1218, prompt: 'designer rejects huge unseen edits', expected: 'designer-sized-edit' },
    { id: 1219, prompt: 'beginner wants safe apply confidence', expected: 'beginner-apply-confidence' },
    { id: 1220, prompt: 'are we reducing bloat where it matters', expected: 'less-bloat-summary' },
]

const deploymentDiagnosticStories: AppStory[] = [
    { id: 1221, prompt: 'vercel build failed but logs are missing', expected: 'missing-build-logs' },
    { id: 1222, prompt: 'env works locally but production says undefined', expected: 'env-prod-mismatch' },
    { id: 1223, prompt: 'preview and production dont match', expected: 'preview-prod-drift' },
    { id: 1224, prompt: 'netlify deploy queue is stuck', expected: 'deploy-queue-stuck' },
    { id: 1225, prompt: 'staging redirects fail but local works', expected: 'staging-redirects' },
    { id: 1226, prompt: 'runtime logs are loading forever', expected: 'runtime-logs-missing' },
    { id: 1227, prompt: 'edge function fails only after deploy', expected: 'edge-deploy-fail' },
    { id: 1228, prompt: 'corporate reviewer needs deploy evidence first', expected: 'corporate-deploy-evidence' },
    { id: 1229, prompt: 'designer says preview is stale', expected: 'designer-stale-preview' },
    { id: 1230, prompt: 'newbie says the website deployed but looks old', expected: 'newbie-old-deploy' },
    { id: 1231, prompt: 'agency client says production is broken', expected: 'agency-prod-broken' },
    { id: 1232, prompt: 'support asks where the build error is', expected: 'support-build-error' },
    { id: 1233, prompt: 'founder demo link is down after deploy', expected: 'founder-demo-down' },
    { id: 1234, prompt: 'pricing page deploy changed environment', expected: 'pricing-env-scope' },
    { id: 1235, prompt: 'mobile preview works but prod mobile fails', expected: 'mobile-preview-prod' },
    { id: 1236, prompt: 'compliance says dont expose secrets in logs', expected: 'compliance-secret-logs' },
    { id: 1237, prompt: 'terminal agent kept guessing at the deploy bug', expected: 'terminal-no-guessing' },
    { id: 1238, prompt: 'handoff needs exact deploy next check', expected: 'handoff-deploy-check' },
    { id: 1239, prompt: 'client asks why vercel succeeded but app errors', expected: 'client-vercel-runtime' },
    { id: 1240, prompt: 'are these deploy stories actually real world enough', expected: 'real-world-deploy-diagnostics' },
]

async function addLocalAuthCookies(context: BrowserContext, baseURL: string | undefined) {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    const hostname = new URL(cookieUrl).hostname
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
        return
    }

    await context.addCookies([
        { name: 'access_token', value: encodeURIComponent('playwright-token'), url: cookieUrl },
        { name: 'id', value: 'playwright-user', url: cookieUrl },
    ])
}

test('share chat surfaces progress, context, and review gates for ambiguous app stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-ui-story',
                alias: body.path || body.name || body.id || 'app-ui-story',
                path: body.path || body.name || body.id || 'app-ui-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-ui-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string }
        const matchingStory = stories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Prepared a focused ${matchingStory!.expected} page with narrow scope and reviewable changes.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>No fake portals, payments, or sensitive data collection.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of stories) {
        await page.goto(`/s/app-ui-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('No auto-apply')).toBeVisible()
        await expect(page.getByText('Current file context')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(/Prepared a focused/)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('No fake portals, payments, or sensitive data collection.')).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(stories.length)
})

test('share chat keeps the mobile chat viewport unobscured by the explorer rail', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await page.setViewportSize({ width: 520, height: 820 })

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-mobile-chat-story',
                alias: body.path || body.name || body.id || 'app-mobile-chat-story',
                path: body.path || body.name || body.id || 'app-mobile-chat-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-mobile-chat-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.goto('/s/app-mobile-chat-861?new=1')
    await expect(page.getByRole('button', { name: 'Open file explorer' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Open workspace chat' }).click()

    await expect(page.getByText('Chat workspace')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open file explorer' })).toHaveCount(0)
    await expect(page.getByPlaceholder('Ask Hanasand AI to change this project...')).toBeVisible()
    await expect(page.getByText('No auto-apply')).toBeVisible()
})

test('share chat makes no-auto-apply and pending-file state explicit for transparency stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-transparency-story',
                alias: body.path || body.name || body.id || 'app-transparency-story',
                path: body.path || body.name || body.id || 'app-transparency-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-transparency-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string }
        const matchingStory = transparencyStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Prepared ${matchingStory!.expected} changes for manual review.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Manual review required before apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of transparencyStories) {
        await page.goto(`/s/app-transparency-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('No auto-apply')).toBeVisible()
        await expect(page.getByText('Current file context')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Prepared ${story.expected} changes for manual review.`)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('Manual review required before apply.')).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(transparencyStories.length)
})

test('share chat reaches concise two-file review quickly for speed-review stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-speed-review-story',
                alias: body.path || body.name || body.id || 'app-speed-review-story',
                path: body.path || body.name || body.id || 'app-speed-review-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-speed-review-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string }
        const matchingStory = speedReviewStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Done: ${matchingStory!.expected}. Review the two files before applying.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Useful, careful, and scoped. No fake portals, guarantees, uploads, or payments.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/brief.tsx',
                        content: `export const brief = { topic: '${matchingStory!.expected}', review: 'Manual apply only', scope: 'Two small files' }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of speedReviewStories) {
        await page.goto(`/s/app-speed-review-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Done: ${story.expected}. Review the two files before applying.`)).toBeVisible({ timeout: 3000 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('2 file changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/brief.tsx')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(3000)
    }

    expect(handledPrompts).toHaveLength(speedReviewStories.length)
})

test('share chat avoids bloat and exposes review controls for tool-friction stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-tool-friction-story',
                alias: body.path || body.name || body.id || 'app-tool-friction-story',
                path: body.path || body.name || body.id || 'app-tool-friction-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-tool-friction-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = toolFrictionStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2600)
        expect(body.prompt).toContain('Keep visible prose to at most 5 short sentences')
        expect(body.context?.length || 0).toBeLessThan(12_000)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Two scoped files are waiting for review.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Clear next step, careful claims, and no fake backend promises.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/review-notes.ts',
                        content: 'export const reviewNotes = [\'Manual review before apply\', \'No fake payments, portals, uploads, guarantees, or hidden background work\']',
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of toolFrictionStories) {
        await page.goto(`/s/app-tool-friction-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Two scoped files are waiting for review.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('2 file changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/review-notes.ts')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        await expect(page.getByText('No fake payments, portals, uploads, guarantees, or hidden background work')).toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(toolFrictionStories.length)
})

test('share chat keeps context lean while resolving context-budget stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-context-budget-story',
                alias: body.path || body.name || body.id || 'app-context-budget-story',
                path: body.path || body.name || body.id || 'app-context-budget-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-context-budget-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = contextBudgetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.context?.length || 0).toBeLessThan(9_000)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Review the files, then apply.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Plain next step, careful scope, and no invented system behind it.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/decision.ts',
                        content: `export const decision = { changed: '${matchingStory!.expected}', mode: 'lean context', apply: 'manual' }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of contextBudgetStories) {
        await page.goto(`/s/app-context-budget-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Review the files, then apply.`)).toBeVisible({ timeout: 2200 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/decision.ts')).toBeVisible()
        await expect(page.getByText('lean context')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2200)
    }

    expect(handledPrompts).toHaveLength(contextBudgetStories.length)
})

test('share page AI shows browser proof in the website UI for ambiguous build stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-share-browser-proof-story',
                alias: body.path || body.name || body.id || 'app-share-browser-proof-story',
                path: body.path || body.name || body.id || 'app-share-browser-proof-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-share-browser-proof-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url || 'https://example.com',
                title: 'Share Preview OK',
                textExcerpt: 'Visible preview with hero, pricing, contact, booking caveat, and next step.',
                structure: {
                    headings: ['Visible preview', 'Pricing', 'Contact'],
                    links: [
                        { text: 'Contact support', href: '/contact' },
                        { text: 'Pricing', href: '/pricing' },
                    ],
                    buttons: ['Start review', 'Book demo'],
                    inputs: ['Email address / email'],
                    forms: ['Email address / email | Start review'],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = shareBrowserEvidenceStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.prompt).toContain('Use browser evidence before claiming a page works')
        expect(body.context?.length || 0).toBeLessThan(9_000)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Browser proof is visible before apply.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: 'https://example.com',
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Visible proof first, careful claims, no fake backend promises.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/proof.ts',
                        content: `export const proof = { browser: true, apply: 'manual', topic: '${matchingStory!.expected}' }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of shareBrowserEvidenceStories) {
        await page.goto(`/s/app-share-browser-proof-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Browser proof is visible before apply.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Browser proof visible for https://example.com.')).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Browser proof', { exact: true }).last()).toBeVisible()
        await expect(page.getByText('Visible preview').last()).toBeVisible()
        await expect(page.getByText('Contact support -> /contact').last()).toBeVisible()
        await expect(page.getByText('Viewport meta present').last()).toBeVisible()
        await expect(page.getByText('Screenshot not available yet').last()).toBeVisible()
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/proof.ts')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(shareBrowserEvidenceStories.length)
})

test('share page AI uses the current share URL for browser evidence instead of generic examples', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-share-evidence-target-story',
                alias: body.path || body.name || body.id || 'app-share-evidence-target-story',
                path: body.path || body.name || body.id || 'app-share-evidence-target-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-share-evidence-target-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-share-target-')
        expect(body.url).not.toBe('https://example.com')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url,
                title: 'Current Share Evidence',
                textExcerpt: 'Current share proof with visible navigation and no generic sample target.',
                structure: {
                    headings: ['Current share proof', 'Visible next step'],
                    links: [{ text: 'Open share', href: body.url }],
                    buttons: ['Apply after review'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = shareEvidenceTargetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-share-target-${matchingStory!.id}`
        expect(body.prompt).toContain('Browser evidence targets:')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.prompt).toContain(`"url":"${expectedUrl}"`)
        expect(body.prompt).not.toContain('"url":"https://example.com"')
        expect(body.context).toContain(expectedUrl)
        expect(body.context?.length || 0).toBeLessThan(9_500)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. I checked the current share URL, not a sample page.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Current-share evidence first, then manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of shareEvidenceTargetStories) {
        await page.goto(`/s/app-share-target-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. I checked the current share URL, not a sample page.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof visible for https://hanasand.com/s/app-share-target-${story.id}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Current share proof').last()).toBeVisible()
        await expect(page.getByText(`Open share -> https://hanasand.com/s/app-share-target-${story.id}`).last()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(shareEvidenceTargetStories.length)
})

test('share page AI shows the browser proof target before users send ambiguous prompts', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-visible-proof-target-story',
                alias: body.path || body.name || body.id || 'app-visible-proof-target-story',
                path: body.path || body.name || body.id || 'app-visible-proof-target-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-visible-proof-target-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-visible-target-')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url,
                title: 'Visible Target Evidence',
                textExcerpt: 'The proof target is visible before the user sends.',
                structure: {
                    headings: ['Visible proof target', 'Trustworthy evidence'],
                    links: [{ text: 'Current target', href: body.url }],
                    buttons: ['Review'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string }
        const matchingStory = visibleProofTargetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-visible-target-${matchingStory!.id}`
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. The proof target was visible before the check.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Visible proof target, compact response, manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of visibleProofTargetStories) {
        const expectedUrl = `https://hanasand.com/s/app-visible-target-${story.id}`
        await page.goto(`/s/app-visible-target-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Current share target')).toBeVisible()
        await expect(page.getByText(expectedUrl)).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. The proof target was visible before the check.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof visible for ${expectedUrl}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Visible proof target').last()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(visibleProofTargetStories.length)
})

test('share page AI summarizes browser evidence in the chat status strip for fast handoff', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-evidence-summary-story',
                alias: body.path || body.name || body.id || 'app-evidence-summary-story',
                path: body.path || body.name || body.id || 'app-evidence-summary-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-evidence-summary-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        const storyId = Number(body.url?.match(/app-proof-strip-(\d+)/)?.[1] || 0)
        expect(storyId).toBeGreaterThanOrEqual(1081)
        const hasScreenshot = storyId % 2 === 0
        const hasIssue = storyId % 3 === 0
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url,
                title: `Proof Strip ${storyId}`,
                textExcerpt: 'Compact proof strip with title, URL, issue count, and screenshot state.',
                structure: {
                    headings: [`Proof strip ${storyId}`, 'Fast handoff'],
                    links: [{ text: 'Open checked page', href: body.url }],
                    buttons: ['Review proof'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                screenshotPath: hasScreenshot ? `/screenshots/proof-strip-${storyId}.png` : null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: hasIssue ? ['Visible issue found in proof strip test'] : [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = evidenceSummaryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-proof-strip-${matchingStory!.id}`
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        expect(body.context?.length || 0).toBeLessThan(9_500)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Proof summary is visible in the chat strip.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Fast proof summary, no terminal scrollback, manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of evidenceSummaryStories) {
        const expectedUrl = `https://hanasand.com/s/app-proof-strip-${story.id}`
        await page.goto(`/s/app-proof-strip-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Proof summary is visible in the chat strip.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof: Proof Strip ${story.id}`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('2 headings').first()).toBeVisible()
        await expect(page.getByText(`${story.id % 3 === 0 ? 1 : 0} issues`).first()).toBeVisible()
        await expect(page.getByText(story.id % 2 === 0 ? 'Screenshot captured' : 'No screenshot').first()).toBeVisible()
        await expect(page.getByText(`Browser proof visible for ${expectedUrl}.`)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(evidenceSummaryStories.length)
})

test('share page AI shows a bounded last-run receipt for ambiguous user requests', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-run-summary-story',
                alias: body.path || body.name || body.id || 'app-run-summary-story',
                path: body.path || body.name || body.id || 'app-run-summary-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-run-summary-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-run-summary-')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url,
                title: 'Run Summary Proof',
                textExcerpt: 'The last-run receipt shows duration, edit count, browser proof count, and token cap.',
                structure: {
                    headings: ['Run summary proof', 'Bounded progress'],
                    links: [{ text: 'Checked page', href: body.url }],
                    buttons: ['Review'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = runSummaryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-run-summary-${matchingStory!.id}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain('Keep visible prose to at most 5 short sentences')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        expect(body.context?.length || 0).toBeLessThan(9_500)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Run receipt is visible without terminal logs.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Bounded last run, browser proof, and manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of runSummaryStories) {
        const expectedUrl = `https://hanasand.com/s/app-run-summary-${story.id}`
        await page.goto(`/s/app-run-summary-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Run receipt is visible without terminal logs.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Last run', { exact: true })).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('1 edit')).toBeVisible()
        await expect(page.getByText('1 browser proof')).toBeVisible()
        await expect(page.getByText('2.2k cap')).toBeVisible()
        await expect(page.getByText('Completed', { exact: true })).toBeVisible()
        await expect(page.getByText('Browser proof: Run Summary Proof')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(runSummaryStories.length)
})

test('share page AI marks the last run as needing retry when browser proof fails', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-browser-retry-story',
                alias: body.path || body.name || body.id || 'app-browser-retry-story',
                path: body.path || body.name || body.id || 'app-browser-retry-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-browser-retry-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-browser-retry-')
        await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Browser evidence timed out.' }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = browserRetryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-browser-retry-${matchingStory!.id}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain('Use browser evidence before claiming a page works')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Browser proof must show retry if it fails.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Do not claim browser proof succeeded when it failed.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of browserRetryStories) {
        const expectedUrl = `https://hanasand.com/s/app-browser-retry-${story.id}`
        await page.goto(`/s/app-browser-retry-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Browser proof must show retry if it fails.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Last run', { exact: true })).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).toBeVisible()
        await expect(page.getByText('Completed', { exact: true })).not.toBeVisible()
        await expect(page.getByText('1 edit')).toBeVisible()
        await expect(page.getByText('1 browser proof')).toBeVisible()
        await expect(page.getByText('2.2k cap')).toBeVisible()
        await expect(page.getByText('Browser proof: Untitled page')).toBeVisible()
        await expect(page.getByText('1 issues')).toBeVisible()
        await expect(page.getByText('Page issues: 1.')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(browserRetryStories.length)
})

test('share page AI blocks applying pending edits when browser proof needs retry', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-proof-gate-story',
                alias: body.path || body.name || body.id || 'app-proof-gate-story',
                path: body.path || body.name || body.id || 'app-proof-gate-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-proof-gate-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-proof-gate-')
        await route.fulfill({
            status: 504,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Browser proof gateway timeout.' }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = proofGateStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-proof-gate-${matchingStory!.id}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Apply must stay blocked until browser proof succeeds.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Apply stays blocked while proof needs retry.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of proofGateStories) {
        const expectedUrl = `https://hanasand.com/s/app-proof-gate-${story.id}`
        await page.goto(`/s/app-proof-gate-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Apply must stay blocked until browser proof succeeds.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).toBeVisible()
        await expect(page.getByText('Browser proof needs retry before these changes can be applied.')).toBeVisible()
        const applyButton = page.getByRole('button', { name: 'Retry proof first' })
        await expect(applyButton).toBeVisible()
        await expect(applyButton).toBeDisabled()
        await expect(page.getByText('Apply', { exact: true })).not.toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('1 issues')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(proofGateStories.length)
})

test('share page AI lets users retry failed browser proof without rerunning the prompt', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-proof-recovery-story',
                alias: body.path || body.name || body.id || 'app-proof-recovery-story',
                path: body.path || body.name || body.id || 'app-proof-recovery-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-proof-recovery-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const proofAttempts = new Map<string, number>()
    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-proof-recovery-')
        const url = body.url || ''
        const attempts = proofAttempts.get(url) || 0
        proofAttempts.set(url, attempts + 1)

        if (attempts === 0) {
            await route.fulfill({
                status: 504,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Browser proof gateway timeout.' }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url,
                title: 'Recovered preview',
                screenshotPath: `/browser-proof/${url.split('-').pop()}.png`,
                structure: {
                    headings: ['Recovered proof'],
                    links: [{ text: 'Open page', href: url }],
                    buttons: ['Apply'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                consoleMessages: [],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = proofRecoveryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-proof-recovery-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Retry proof should recover without rerunning the prompt.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Retry proof unlocks apply after browser evidence succeeds.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of proofRecoveryStories) {
        const expectedUrl = `https://hanasand.com/s/app-proof-recovery-${story.id}-${runSlug}`
        await page.goto(`/s/app-proof-recovery-${story.id}-${runSlug}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Retry proof should recover without rerunning the prompt.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).toBeVisible()
        await expect(page.getByText('Browser proof needs retry before these changes can be applied.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Retry proof first' })).toBeDisabled()
        const retryButton = page.getByRole('button', { name: 'Retry proof', exact: true })
        await expect(retryButton).toBeVisible()
        await retryButton.click()

        await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).not.toBeVisible()
        await expect(page.getByText('Browser proof needs retry before these changes can be applied.')).not.toBeVisible()
        await expect(page.getByText('Browser proof: Recovered preview')).toBeVisible()
        await expect(page.getByText('0 issues')).toBeVisible()
        await expect(page.getByText('Screenshot captured')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeEnabled()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(3200)
        expect(proofAttempts.get(expectedUrl)).toBe(2)
    }

    expect(handledPrompts).toHaveLength(proofRecoveryStories.length)
})

test('share page AI treats unapplied edits as a checkpoint before another run', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-pending-checkpoint-story',
                alias: body.path || body.name || body.id || 'app-pending-checkpoint-story',
                path: body.path || body.name || body.id || 'app-pending-checkpoint-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-pending-checkpoint-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = pendingCheckpointStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-pending-checkpoint-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Pending work must be resolved before the next run.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Pending checkpoint protects this draft.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of pendingCheckpointStories) {
        const expectedUrl = `https://hanasand.com/s/app-pending-checkpoint-${story.id}-${runSlug}`
        await page.goto(`/s/app-pending-checkpoint-${story.id}-${runSlug}?new=1`)
        const chatButton = page.getByRole('button', { name: 'Open workspace chat' })
        await expect(chatButton).toBeVisible({ timeout: 2500 })
        await chatButton.click()
        const promptBox = page.getByPlaceholder('Ask Hanasand AI to change this project...')
        await expect(promptBox).toBeVisible({ timeout: 2500 })
        await promptBox.fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Pending work must be resolved before the next run.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Review', { exact: true })).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Resolve the pending change before starting another AI run.')).toBeVisible()
        await expect(page.getByText('Apply or discard the pending change before asking for another edit.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible()

        await promptBox.fill('actually do something else')
        await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
        await page.getByRole('button', { name: 'Discard' }).click()
        await expect(page.getByText('1 pending change')).not.toBeVisible()
        await expect(page.getByText('Resolve the pending change before starting another AI run.')).not.toBeVisible()
        await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(pendingCheckpointStories.length)
})

test('share page AI shows compact pending change summaries before raw diffs', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-pending-summary-story',
                alias: body.path || body.name || body.id || 'app-pending-summary-story',
                path: body.path || body.name || body.id || 'app-pending-summary-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-pending-summary-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = pendingSummaryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-pending-summary-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Change summary should be visible before the raw diff.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: [
                            'export default function Page() {',
                            `  return <main><h1>${matchingStory!.expected}</h1><p>Compact change summary before code.</p></main>`,
                            '}',
                        ].join('\n'),
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of pendingSummaryStories) {
        const expectedUrl = `https://hanasand.com/s/app-pending-summary-${story.id}-${runSlug}`
        await page.goto(`/s/app-pending-summary-${story.id}-${runSlug}?new=1`)
        const chatButton = page.getByRole('button', { name: 'Open workspace chat' })
        await expect(chatButton).toBeVisible({ timeout: 2500 })
        await chatButton.click()
        const promptBox = page.getByPlaceholder('Ask Hanasand AI to change this project...')
        await expect(promptBox).toBeVisible({ timeout: 2500 })
        await promptBox.fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Change summary should be visible before the raw diff.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('3 lines')).toBeVisible()
        await expect(page.getByText('+3')).toBeVisible()
        await expect(page.getByText('-0')).toBeVisible()
        await expect(page.getByText('New file', { exact: true })).toBeVisible()
        await expect(page.getByText('+ export default function Page() {')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
        await page.getByRole('button', { name: 'Discard' }).click()
    }

    expect(handledPrompts).toHaveLength(pendingSummaryStories.length)
})

test('share page AI switches to deployment diagnostics for real hosting failures', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-deploy-diagnostic-story',
                alias: body.path || body.name || body.id || 'app-deploy-diagnostic-story',
                path: body.path || body.name || body.id || 'app-deploy-diagnostic-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-deploy-diagnostic-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = deploymentDiagnosticStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-deploy-diagnostic-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain('Deployment diagnostic mode:')
        expect(body.prompt).toContain('do not guess and do not edit first')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain('"diagnosticMode":true')
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}.`,
                    'Diagnostic checklist: target URL, environment scope, last changed config/package files, exact build/runtime log evidence, and the smallest safe next check.',
                    'No edit yet; missing deploy evidence would make this a guess.',
                ].join('\n'),
            }),
        })
    })

    for (const story of deploymentDiagnosticStories) {
        const expectedUrl = `https://hanasand.com/s/app-deploy-diagnostic-${story.id}-${runSlug}`
        await page.goto(`/s/app-deploy-diagnostic-${story.id}-${runSlug}?new=1`)
        const chatButton = page.getByRole('button', { name: 'Open workspace chat' })
        await expect(chatButton).toBeVisible({ timeout: 2500 })
        await chatButton.click()
        const promptBox = page.getByPlaceholder('Ask Hanasand AI to change this project...')
        await expect(promptBox).toBeVisible({ timeout: 2500 })
        await promptBox.fill(story.prompt)
        await expect(page.getByText('Diagnostic mode: collect target, logs, env scope, and preview evidence before editing.')).toBeVisible()
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Diagnostic checklist: target URL, environment scope, last changed config/package files, exact build/runtime log evidence, and the smallest safe next check.')).toBeVisible()
        await expect(page.getByText('No edit yet; missing deploy evidence would make this a guess.')).toBeVisible()
        await expect(page.getByText('1 pending change')).not.toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).not.toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(deploymentDiagnosticStories.length)
})
