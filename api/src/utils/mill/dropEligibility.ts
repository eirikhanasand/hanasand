// Low-only is the rule creation invariant. Storage protection policy is read
// from enabled Mill Analysis Store rules by customRetention.
export function eligibleCustomDrop(event: Record<string, unknown>): boolean {
    return event.severity === 'low'
}
