import assert from 'node:assert/strict'
import { buildNoteUpdateFields } from '../src/utils/notes.ts'

assert.equal(buildNoteUpdateFields(undefined), null)
assert.equal(buildNoteUpdateFields({}), null)

const blankContent = buildNoteUpdateFields({ content: '' })
assert.deepEqual(blankContent, {
    fields: ['content = $1'],
    values: [''],
})

const blankTitleAndSource = buildNoteUpdateFields({ title: '   ', source: '   ' })
assert.deepEqual(blankTitleAndSource, {
    fields: ['title = $1', 'source = $2'],
    values: ['Untitled', 'api'],
})

const fullUpdate = buildNoteUpdateFields({ title: ' Roadmap ', content: ' Ship notes ', source: ' desktop ' })
assert.deepEqual(fullUpdate, {
    fields: ['title = $1', 'content = $2', 'source = $3'],
    values: ['Roadmap', 'Ship notes', 'desktop'],
})

console.log('Notes smoke passed for explicit blank updates and defaulted note fields.')
