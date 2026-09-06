export type ReviewEvent = { event_id: string, item_id: string, content_hash: string, review_hash: string, approved: boolean, reviewer: string, reviewed_at: string }
export type CodeItem = {
    id: string, kind: 'frontend' | 'api' | 'database' | 'source', title: string, file: string,
    line?: number, sha256: string, reviewHash: string, dependencies: string[], dependencyCount: number,
    unresolved: string[], content?: string, review?: ReviewEvent,
}
export type CodeInventory = { version: number, hash: string, nodes: CodeItem[], release?: string, revision?: string, sync?: { phase: string, checkedAt?: string, error?: string, warning?: string } }
export function reviewStatus(item: CodeItem) {
    return !item.review ? 'unreviewed' : item.review.review_hash !== item.reviewHash ? 'changed' : item.review.approved ? 'approved' : 'unreviewed'
}

export function reviewPriority(item: CodeItem, now = Date.now()) {
    if (reviewStatus(item) === 'approved') return 2
    const reviewedAt = item.review ? Date.parse(item.review.reviewed_at) : NaN
    return item.review?.approved && reviewStatus(item) === 'changed' && now - reviewedAt < 14 * 24 * 60 * 60 * 1000 ? 1 : 0
}
