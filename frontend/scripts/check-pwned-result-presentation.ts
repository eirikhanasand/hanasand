import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PwnedSearch from '../src/components/pwned/pwnedSearch'

const markup = renderToStaticMarkup(React.createElement(PwnedSearch, {
    breached: true,
    breachCount: 1,
    checkedPrefix: '5BAA6',
}))

assert.match(markup, /Exact match found/)
assert.match(markup, /5BAA6/)
assert.match(markup, /without sending the full hash or underlying secret to Hanasand/i)
assert.doesNotMatch(markup, /password123|all_in_one_sorted|byte\s+\d+/i)
assert.match(markup, /bg-ui-danger\/10/)
assert.match(markup, /text-ui-danger/)
assert.match(markup, /text-ui-muted/)

console.log('Pwned result presentation checks passed.')
