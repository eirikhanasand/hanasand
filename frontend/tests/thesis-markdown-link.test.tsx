import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { compactMarkdownLinkLabel } from '../src/app/thesis/markdownLink'
import { thesisMarkdownComponents } from '../src/app/thesis/markdownComponents'

test('compact markdown links display host and path while preserving their destination', () => {
    const url = 'https://flare.io/cyber-threat-intelligence-platform'
    assert.equal(compactMarkdownLinkLabel(url, url), 'flare.io/cyber-threat-intelligence-platform')
    assert.equal(compactMarkdownLinkLabel('https://flare.io/', 'https://flare.io/'), 'flare.io')
    assert.equal(compactMarkdownLinkLabel(url, 'Flare CTI'), 'Flare CTI')
    assert.equal(compactMarkdownLinkLabel(url, 'https://other.example/path'), 'https://other.example/path')
    assert.equal(compactMarkdownLinkLabel('mailto:help@example.com', 'mailto:help@example.com'), 'mailto:help@example.com')
})

test('markdown renders a same-URL link as a compact clickable anchor', () => {
    const url = 'https://flare.io/cyber-threat-intelligence-platform'
    const markup = renderToStaticMarkup(<Markdown components={thesisMarkdownComponents} remarkPlugins={[remarkGfm]}>{`[${url}](${url})`}</Markdown>)
    assert.equal(markup, `<p><a href="${url}">flare.io/cyber-threat-intelligence-platform</a></p>`)
})
