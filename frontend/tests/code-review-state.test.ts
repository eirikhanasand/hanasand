import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readSheets, writeSheets, sheetChanges } from '../src/app/thesis/workspace'
import { reviewStatus, type CodeItem } from '../src/utils/codeReviewTypes'

test('per-sheet preferences round trip and participate in shared history', () => {
    const sheets = [{ id: 'code', name: 'Code', title: '# Code', body: '\n\nNotes\n', settings: { insertTable: false, history: false, codeReview: true } }]
    assert.deepEqual(readSheets('# Thesis', writeSheets(sheets)), sheets)
    assert.equal(sheetChanges(sheets, [{ ...sheets[0], settings: { ...sheets[0].settings, history: true } }]).length, 1)
})
test('approval belongs to the exact source and dependency version', () => {
    const item = { reviewHash: 'current' } as CodeItem
    assert.equal(reviewStatus(item), 'unreviewed')
    item.review = { event_id: 'event', item_id: 'item', approved: true, content_hash: 'source', review_hash: 'current', reviewer: 'owner', reviewed_at: '2026-09-06T12:00:00Z' }
    assert.equal(reviewStatus(item), 'approved')
    item.reviewHash = 'dependency changed'
    assert.equal(reviewStatus(item), 'changed')
    assert.equal(item.review.review_hash, 'current')
    item.reviewHash = 'current'; item.review.approved = false
    assert.equal(reviewStatus(item), 'unreviewed')
})
