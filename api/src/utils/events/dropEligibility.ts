// Drop selectors are retention predicates, not severity classifiers. Severity
// is kept for triage and detection; it must not decide whether a selector can
// match. Evidence protection is evaluated separately by customRetention.
export function eligibleCustomDrop(): boolean {
    return true
}
