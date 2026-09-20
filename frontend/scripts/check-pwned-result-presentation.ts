import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PwnedSearch from '../src/components/pwned/pwnedSearch'

const markup = renderToStaticMarkup(React.createElement(PwnedSearch, {
    breached: true,
    breachCount: 1,
}))

assert.match(markup, /Exact match found/)
assert.match(markup, /This password has been breached 1 time\./)
assert.doesNotMatch(markup, /Privacy check:|Next action:|Rotate the underlying secret/)
assert.doesNotMatch(markup, /password123|all_in_one_sorted|byte\s+\d+/i)
assert.match(markup, /bg-ui-danger\/10/)
assert.match(markup, /text-ui-danger/)
const pluralMarkup = renderToStaticMarkup(React.createElement(PwnedSearch, {
    breached: true,
    breachCount: 23,
}))
assert.match(pluralMarkup, /This password has been breached 23 times\./)

const noMatchMarkup = renderToStaticMarkup(React.createElement(PwnedSearch, {
    breached: false,
    breachCount: 0,
}))
assert.match(noMatchMarkup, /No exact match found/)
assert.doesNotMatch(noMatchMarkup, /This password has been breached|Privacy check:|Next action:/)

console.log('Pwned result presentation checks passed.')
