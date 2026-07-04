export type DwmNextOperatorActionKind = 'reopen' | 'open_case_link' | 'open_case' | 'review' | 'send' | 'test' | 'replay' | 'close' | 'suppress' | 'wait'

export type DwmNextOperatorActionInput = {
    reviewState: string
    deliveryState?: string
    latestDeliveryStatus?: string
    latestDeliverySummary?: string
    caseHref?: string
    caseReady: boolean
    transitionReady: boolean
    replayReady: boolean
    deliverReady: boolean
    closeReady: boolean
    reopenReady: boolean
    suppressReady: boolean
}

export type DwmNextOperatorAction = {
    kind: DwmNextOperatorActionKind
    label: string
    detail: string
    cta: string
    href?: string
    disabled: boolean
}

export function dwmNextOperatorAction(input: DwmNextOperatorActionInput): DwmNextOperatorAction {
    if (input.reviewState === 'resolved' || input.deliveryState === 'muted' || input.reviewState === 'false_positive') {
        return {
            kind: 'reopen',
            label: 'Reopen for review',
            detail: 'This alert is no longer active. Reopen it only if new evidence or a customer request requires review.',
            cta: 'Reopen',
            disabled: !input.reopenReady,
        }
    }

    if (input.caseHref) {
        return {
            kind: 'open_case_link',
            label: input.latestDeliveryStatus ? 'Review case and delivery trail' : 'Continue in the linked case',
            detail: input.latestDeliverySummary
                ? `Latest delivery is ${input.latestDeliverySummary}.`
                : 'The case is linked. Continue investigation, ownership, and customer notes in the case trail.',
            cta: 'Open case',
            href: input.caseHref,
            disabled: false,
        }
    }

    if (input.caseReady) {
        return {
            kind: 'open_case',
            label: 'Open the case',
            detail: 'Evidence is present. Open a case before delivery so analyst notes, owner, and replay context are preserved.',
            cta: 'Open case',
            disabled: false,
        }
    }

    if (input.transitionReady && input.reviewState !== 'reviewing') {
        return {
            kind: 'review',
            label: 'Start analyst review',
            detail: 'Mark the alert as under review before suppressing, escalating, or sending customer delivery.',
            cta: 'Review',
            disabled: false,
        }
    }

    if (input.deliverReady && input.latestDeliveryStatus === 'dry_run') {
        return {
            kind: 'send',
            label: 'Send customer delivery',
            detail: 'A dry-run delivery exists. Send only after the case and customer-safe evidence are ready.',
            cta: 'Send',
            disabled: false,
        }
    }

    if (input.deliverReady) {
        return {
            kind: 'test',
            label: 'Test delivery route',
            detail: 'Run a dry delivery first to validate the configured destination and record the attempt.',
            cta: 'Test',
            disabled: false,
        }
    }

    if (input.replayReady) {
        return {
            kind: 'replay',
            label: 'Replay evidence',
            detail: 'Replay the source match to refresh evidence context before case or delivery actions.',
            cta: 'Replay',
            disabled: false,
        }
    }

    if (input.closeReady || input.suppressReady) {
        return {
            kind: input.closeReady ? 'close' : 'suppress',
            label: 'Close or suppress after review',
            detail: 'No delivery route is ready. Close the alert if it is resolved, or suppress it if the match is not relevant.',
            cta: input.closeReady ? 'Close' : 'Suppress',
            disabled: false,
        }
    }

    return {
        kind: 'wait',
        label: 'Waiting for source context',
        detail: 'The alert needs source evidence or route state before case, replay, or delivery actions can run.',
        cta: 'Unavailable',
        disabled: true,
    }
}
