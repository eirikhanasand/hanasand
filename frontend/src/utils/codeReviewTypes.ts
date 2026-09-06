export type ReviewEvent = { event_id: string, item_id: string, content_hash: string, review_hash: string, approved: boolean, reviewer: string, reviewed_at: string }
export type CodeItem = {
    id: string, kind: 'frontend' | 'api' | 'database' | 'source', title: string, file: string,
    line?: number, sha256: string, reviewHash: string, dependencies: string[], dependencyCount: number,
    unresolved: string[], content?: string, review?: ReviewEvent,
}
export type CodeInventory = { version: number, hash: string, nodes: CodeItem[], release?: string }
export function reviewStatus(item: CodeItem) {
    return !item.review ? 'unreviewed' : item.review.review_hash !== item.reviewHash ? 'changed' : item.review.approved ? 'approved' : 'unreviewed'
}
