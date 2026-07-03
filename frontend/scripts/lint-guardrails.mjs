import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')
const srcRoot = path.join(root, 'src')
const metadataFile = path.join(srcRoot, 'app', 'metadata.tsx')
const errors = []
const bannedPublicCopyPatterns = [
    /\bGlobal API pressure\b/i,
    /\broute overrides\b/i,
    /\bscoped tiered tokens\b/i,
    /\bnow live in the same surface\b/i,
    /\btuned independently\b/i,
    /\bwill appear here\b/i,
    /\bIssue owner-linked keys\b/i,
    /\bOwner user ID\b/i,
    /\bindependent second,\s*minute,\s*hour,\s*and day budgets\b/i,
    /\bper second,\s*minute,\s*hour,\s*and day\b/i,
    /\bcurrent proof\b/i,
    /\bcustomer workflow proof\b/i,
    /\bentitlement readiness\b/i,
    /\breadiness proof\b/i,
    /\bproof is not loaded\b/i,
    /\bwhat is backed by loaded readiness data\b/i,
    /\binspect readiness\b/i,
    /\bopen readiness\b/i,
    /\bscraper posts metadata\b/i,
    /\bHanasand AI parser output\b/i,
    /\bAI parser output\b/i,
    /\bactor-page,\s*public-channel\b/i,
    /\bcollection cycle\b/i,
    /\bstatus attaching\b/i,
    /\bsource attaching\b/i,
    /\bsource registry is attaching\b/i,
    /\brequest attaching\b/i,
    /\bentity attaching\b/i,
    /\bAttach fresh source\/capture provenance\b/i,
    /\bSource operations are quiet\b/i,
    /\bLog stream quiet\b/i,
    /\bLog stream is quiet\b/i,
    /\bQuery watcher quiet\b/i,
    /\bHealthy quiet\b/i,
    /\bproof jobs\b/i,
    /\bproof failures\b/i,
    /\bcollecting proof\b/i,
    /\bland here\b/i,
    /\bpins here\b/i,
    /\bpinned here\b/i,
    /\bstay pinned here\b/i,
    /\brecent results are pinned\b/i,
    /\bpin the first row\b/i,
    /\battached here\b/i,
    /\bstay visible here\b/i,
    /\bpublished a snapshot\b/i,
    /\bsnapshot poll\b/i,
    /\bn\/a\b/i,
    /\bafter the next scan\b/i,
    /\binternal API checks\b/i,
    /\bis quiet\b/i,
    /\bare quiet\b/i,
    /\battaches after\b/i,
    /\bBackground jobs loaded\b/i,
    /\bLoaded alert settings\b/i,
    /\bNo failures recorded\b/i,
    /\bnot scheduled\b/i,
    /\bRoute will not check\b/i,
    /\bOperational readiness\b/i,
    /\bProduct readiness\b/i,
    /\bThreat monitoring readiness\b/i,
    /\breadiness contract\b/i,
    /\bProof source\b/i,
    /\bReadiness groups\b/i,
    /\bOperational evidence\b/i,
    /\bProduct readiness ledger\b/i,
    /\bbackend proof rows\b/i,
    /\bLedger state\b/i,
    /\bReadiness source\b/i,
    /\bProof APIs\b/i,
    /\bfresh proof\b/i,
    /\bsnapshot loaded\b/i,
    /\bNo backed route returned\b/i,
    /\bUI proof\b/i,
    /\btraffic snapshot\b/i,
    /\brequest snapshots\b/i,
    /\bLive snapshot\b/i,
    /\bSource snapshot\b/i,
    /\bproduct snapshot\b/i,
    /\bin this snapshot\b/i,
    /\bbackend error\b/i,
    /\bDocker snapshot\b/i,
    /\bControl feed loaded\b/i,
    /\bprofile snapshots\b/i,
    /\bRestore readiness\b/i,
    /\brestricted metadata\b/i,
    /\bdraft loaded\b/i,
    /\bparser output\b/i,
    /\bstate unavailable\b/i,
    /\bRequest metadata\b/i,
    /\bparser issue\b/i,
    /\bmetadata-only boundaries\b/i,
    /\bwaiting on live checks\b/i,
    /\bpublic TI action contract\b/i,
    /\bsaved alerts loaded\b/i,
    /\bAlert rebuild state is loading source coverage\b/i,
    /\bWorkflow state is loading runtime data\b/i,
    /\bloaded but not active\b/i,
    /\bevidence item(?:s)? loaded\b/i,
    /\bReplay waiting on live checks\b/i,
    /\bOrganization loaded\b/i,
    /\bWatchlist loaded\b/i,
    /\bWebhook destination loaded\b/i,
    /\bSupport audit trail loaded\b/i,
    /\bSupport audit loaded\b/i,
    /\bBacked case workflow loaded\b/i,
    /\bSource worker status loaded\b/i,
    /\bSource coverage loaded\b/i,
    /\bAlerts loaded\b/i,
    /\bDestination loaded\b/i,
]
const bannedStaticExposureQueuePatterns = [
    /\bconst\s+feedRows\s*=/,
    /\bNtd Apparel\b/i,
    /\bAerospace & Advanced Composites\b/i,
    /\bIrec Sas\b/i,
    /\b2026-06-2[67]\b/,
]
const bannedRuntimeDwmDemoPatterns = [
    /\b2026-06-27T\b/,
    />Live<\/span>/,
]
const bannedLegacyBackgroundPatterns = [
    { pattern: /\bBackgroundSketches\b/, label: 'old sketch background component' },
    { pattern: /\bbackground-sketch\b/, label: 'old line-art sketch background class' },
    { pattern: /\blumbermill-sketch\b/, label: 'old line-art sketch background class' },
    { pattern: /\bfuture-cabin-sketch\b/, label: 'old line-art sketch background class' },
    { pattern: /--grid-line\b/, label: 'old rectangular atmosphere grid token' },
    { pattern: /linear-gradient\(var\(--grid-line\)/, label: 'old rectangular atmosphere grid background' },
    { pattern: /linear-gradient\(90deg,\s*var\(--grid-line\)/, label: 'old rectangular atmosphere grid background' },
]
const bannedAiMetricsBlockerPatterns = [
    /\bLaunch blockers\b/i,
    /\bneeds proof\b/i,
    /\bneeds work\b/i,
    /\bThe product is on the right path\b/i,
    /\bNext:\s*run more jobs\b/i,
]
const canonicalSpacingScale = new Map([
    ['0rem', '0'],
    ['0.125rem', '0.5'],
    ['0.25rem', '1'],
    ['0.375rem', '1.5'],
    ['0.5rem', '2'],
    ['0.625rem', '2.5'],
    ['0.75rem', '3'],
    ['0.875rem', '3.5'],
    ['1rem', '4'],
    ['1.25rem', '5'],
    ['1.5rem', '6'],
    ['1.75rem', '7'],
    ['2rem', '8'],
    ['2.25rem', '9'],
    ['2.5rem', '10'],
    ['2.75rem', '11'],
    ['3rem', '12'],
    ['3.5rem', '14'],
    ['4rem', '16'],
    ['5rem', '20'],
    ['6rem', '24'],
    ['7rem', '28'],
    ['8rem', '32'],
    ['9rem', '36'],
    ['10rem', '40'],
    ['11rem', '44'],
    ['12rem', '48'],
    ['13rem', '52'],
    ['14rem', '56'],
    ['15rem', '60'],
    ['16rem', '64'],
    ['18rem', '72'],
    ['20rem', '80'],
    ['24rem', '96'],
])
const canonicalTextScale = new Map([
    ['0.75rem', 'xs'],
    ['0.875rem', 'sm'],
    ['1rem', 'base'],
    ['1.125rem', 'lg'],
    ['1.25rem', 'xl'],
    ['1.5rem', '2xl'],
    ['1.875rem', '3xl'],
    ['2.25rem', '4xl'],
    ['3rem', '5xl'],
    ['3.75rem', '6xl'],
    ['4.5rem', '7xl'],
    ['6rem', '8xl'],
    ['8rem', '9xl'],
])
const canonicalLeadingScale = new Map([
    ['0.75rem', '3'],
    ['1rem', '4'],
    ['1.25rem', '5'],
    ['1.5rem', '6'],
    ['1.75rem', '7'],
    ['2rem', '8'],
    ['2.25rem', '9'],
    ['2.5rem', '10'],
    ['3rem', '12'],
])
const canonicalRadiusScale = new Map([
    ['0rem', 'none'],
    ['0.125rem', 'xs'],
    ['0.25rem', 'sm'],
    ['0.375rem', 'md'],
    ['0.5rem', 'lg'],
    ['0.75rem', 'xl'],
    ['1rem', '2xl'],
    ['1.5rem', '3xl'],
    ['2rem', '4xl'],
])
const canonicalAliasClasses = new Map([
    ['break-words', 'wrap-break-word'],
    ['wrap-words', 'wrap-break-word'],
    ['wrap-break-words', 'wrap-break-word'],
])

const sourceFiles = await collectSourceFiles(srcRoot)
const visualGuardFiles = [
    ...sourceFiles,
    path.join(srcRoot, 'app', 'globals.css'),
]

for (const filePath of visualGuardFiles) {
    await validateLegacyBackgroundPatterns(filePath)
}

for (const filePath of sourceFiles) {
    const text = await fs.readFile(filePath, 'utf8')
    const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind)

    if (filePath === metadataFile) {
        validateMetadata(filePath, text)
    }

    validateStaticExposureQueue(filePath, source, text)
    validateRuntimeDwmDemo(filePath, source, text)
    validateAiMetricsCopy(filePath, source, text)

    visit(source, (node) => {
        if (ts.isJsxText(node)) {
            validateBannedPublicCopy(filePath, source, node, node.getText(source), 'JSX text')
            return
        }

        if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
            validateBannedPublicCopy(filePath, source, node, node.text, 'template text')
            return
        }

        if (!ts.isJsxOpeningLikeElement(node)) {
            if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && shouldValidateStringLiteral(node)) {
                validateTokenString(filePath, source, node, node.text, 'string literal')
                validateBannedPublicCopy(filePath, source, node, node.text, 'string literal')
            }
            return
        }

        const tagName = getJsxTagName(node.tagName)
        if (tagName === 'a') {
            validateAnchor(filePath, source, node)
        }

        validateClassAttributes(filePath, source, node)
    })
}

if (errors.length > 0) {
    console.error('\nGuardrail lint failed:\n')
    for (const error of errors) {
        console.error(`- ${error}`)
    }
    process.exit(1)
}

console.log('Guardrail lint passed.')

async function collectSourceFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            return collectSourceFiles(entryPath)
        }

        if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            return [entryPath]
        }

        return []
    }))

    return files.flat()
}

function validateMetadata(filePath, text) {
    if (!/metadataBase:\s*new URL\(['"]https:\/\/hanasand\.com['"]\)/.test(text)) {
        errors.push(`${relative(filePath)}: root metadata must define metadataBase: new URL('https://hanasand.com').`)
    }

    if (!/alternates:\s*\{\s*canonical:\s*['"]\/['"]\s*,?\s*\}/s.test(text)) {
        errors.push(`${relative(filePath)}: root metadata must define alternates.canonical = '/'.`)
    }
}

function validateStaticExposureQueue(filePath, source, text) {
    if (!filePath.endsWith(path.join('src', 'app', 'page.tsx'))) return
    for (const pattern of bannedStaticExposureQueuePatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = source.getLineAndCharacterOfPosition(match.index)
        errors.push(`${relative(filePath)}:${position.line + 1}:${position.character + 1}: homepage exposure queue must be API-backed; remove static live claim data matching ${pattern}.`)
    }
}

function validateRuntimeDwmDemo(filePath, source, text) {
    const relativePath = relative(filePath)
    if (relativePath !== path.join('src', 'app', 'solutions', 'dwm', 'pageClient.tsx')
        && relativePath !== path.join('src', 'utils', 'dwm', 'product.ts')) return
    for (const pattern of bannedRuntimeDwmDemoPatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = source.getLineAndCharacterOfPosition(match.index)
        errors.push(`${relativePath}:${position.line + 1}:${position.character + 1}: DWM runtime demo must not present stale fixed dates or fake live labels matching ${pattern}.`)
    }
}

function validateAiMetricsCopy(filePath, source, text) {
    const relativePath = relative(filePath)
    if (relativePath !== path.join('src', 'app', 'dashboard', 'system', 'ai', 'pageClient.tsx')) return
    for (const pattern of bannedAiMetricsBlockerPatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = source.getLineAndCharacterOfPosition(match.index)
        errors.push(`${relativePath}:${position.line + 1}:${position.character + 1}: AI Metrics must show operational evidence or exact internal action gates, not launch-blocker/prompt-answer copy matching ${pattern}.`)
    }
}

async function validateLegacyBackgroundPatterns(filePath) {
    const text = await fs.readFile(filePath, 'utf8')
    for (const { pattern, label } of bannedLegacyBackgroundPatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = lineAndColumn(text, match.index)
        errors.push(`${relative(filePath)}:${position.line}:${position.column}: ${label} is banned. Use the blue dotted site atmosphere or the clean loading spinner surface instead.`)
    }
}

function validateAnchor(filePath, source, node) {
    const target = getJsxAttributeText(node, 'target')
    const href = getJsxAttributeText(node, 'href')
    const rel = getJsxAttributeText(node, 'rel')

    if (target === '_blank') {
        const relTokens = new Set((rel || '').split(/\s+/).filter(Boolean))
        if (!relTokens.has('noopener') || !relTokens.has('noreferrer')) {
            errors.push(`${formatLocation(filePath, source, node)}: external links using target="_blank" must include rel="noopener noreferrer".`)
        }
    }

    if (href && href.startsWith('/') && !href.startsWith('//')) {
        errors.push(`${formatLocation(filePath, source, node)}: use next/link for internal navigation instead of a raw <a href="${href}">.`)
    }
}

function validateClassAttributes(filePath, source, node) {
    for (const attributeName of ['className', 'class']) {
        const value = getJsxAttributeText(node, attributeName)
        if (!value) {
            continue
        }

        const tokens = value.trim().split(/\s+/).filter(Boolean)
        if (tokens.length === 0) {
            continue
        }

        const seen = new Set()
        const duplicates = new Set()
        for (const token of tokens) {
            if (seen.has(token)) {
                duplicates.add(token)
            }
            seen.add(token)
        }

        if (duplicates.size > 0) {
            errors.push(`${formatLocation(filePath, source, node)}: ${attributeName} contains duplicate utility classes: ${Array.from(duplicates).join(', ')}.`)
        }

        for (const token of tokens) {
            const suggestion = getCanonicalClassSuggestion(token)
            if (suggestion) {
                errors.push(`${formatLocation(filePath, source, node)}: ${attributeName} uses \`${token}\`, write \`${suggestion}\` instead.`)
            }
        }
    }
}

function validateTokenString(filePath, source, node, value, label) {
    const tokens = value.trim().split(/\s+/).filter(Boolean)
    for (const token of tokens) {
        const suggestion = getCanonicalClassSuggestion(token)
        if (suggestion) {
            errors.push(`${formatLocation(filePath, source, node)}: ${label} uses \`${token}\`, write \`${suggestion}\` instead.`)
        }
    }
}

function validateBannedPublicCopy(filePath, source, node, value, label) {
    if (!value || !shouldValidateVisibleCopy(filePath)) return
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (!normalized) return

    for (const pattern of bannedPublicCopyPatterns) {
        if (pattern.test(normalized)) {
            errors.push(`${formatLocation(filePath, source, node)}: ${label} contains banned public website copy matching ${pattern}. Use operator/action language instead.`)
        }
    }
}

function shouldValidateVisibleCopy(filePath) {
    const relativePath = relative(filePath)
    return relativePath.startsWith('src/app/')
        || relativePath.startsWith('src/components/')
        || relativePath.startsWith('src/utils/')
}

function getCanonicalClassSuggestion(token) {
    const aliasMatch = token.match(/^((?:[^:\s]+:)*)((?:!?[^:\s]+))$/)
    if (aliasMatch) {
        const [, variants, utility] = aliasMatch
        const canonicalAlias = canonicalAliasClasses.get(utility)
        if (canonicalAlias) {
            return `${variants}${canonicalAlias}`
        }
    }

    const negativeTranslateMatch = token.match(/^((?:[^:\s]+:)*)-translate-([xy])-\[([^\]]+)\]$/)
    if (negativeTranslateMatch) {
        const [, variants, axis, rawValue] = negativeTranslateMatch
        return `${variants}translate-${axis}-[-${rawValue}]`
    }

    const negativeVariableCalcMatch = token.match(
        /^((?:[^:\s]+:)*)((?:!?)(?:m(?:[trblxy])?|inset(?:-[xy])?|top|right|bottom|left))-\[calc\(var\((--[^)\]]+)\)\s*\*\s*-1\)\]$/
    )
    if (negativeVariableCalcMatch) {
        const [, variants, utility, variableName] = negativeVariableCalcMatch
        return `${variants}-${utility}-(${variableName})`
    }

    const variableMatch = token.match(/^((?:[^:\s]+:)*)((?:!?[^:\s[]+))-\[var\((--[^)\]]+)\)\](\/[^\s]+)?$/)
    if (variableMatch) {
        const [, variants, utility, variableName, suffix = ''] = variableMatch
        return `${variants}${utility}-(${variableName})${suffix}`
    }

    const arbitraryOpacityMatch = token.match(/^((?:[^:\s]+:)*)((?:!?[^:\s/][^:\s]*))\/\[(.+)\]$/)
    if (arbitraryOpacityMatch) {
        const [, variants, utility, rawValue] = arbitraryOpacityMatch
        const canonicalOpacity = normalizeOpacityValue(rawValue)
        if (canonicalOpacity) {
            return `${variants}${utility}/${canonicalOpacity}`
        }
    }

    for (const [utilityPattern, scale] of [
        [/^((?:[^:\s]+:)*)((?:-)?(?:p|m)(?:[trblxy])?|gap(?:-[xy])?|space-[xy]|(?:min-|max-)?[wh]|size)-\[(.+)\]$/, canonicalSpacingScale],
        [/^((?:[^:\s]+:)*)((?:-)?text)-\[(.+)\]$/, canonicalTextScale],
        [/^((?:[^:\s]+:)*)((?:-)?leading)-\[(.+)\]$/, canonicalLeadingScale],
        [/^((?:[^:\s]+:)*)((?:!?rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|ee|es))?))-\[(.+)\]$/, canonicalRadiusScale],
    ]) {
        const match = token.match(utilityPattern)
        if (!match) {
            continue
        }

        const [, variants, utility, rawValue] = match
        const normalized = normalizeSpacingValue(rawValue)
        if (!normalized) {
            continue
        }

        const canonical = scale.get(normalized)
        if (canonical) {
            return `${variants}${utility}-${canonical}`
        }
    }

    return null
}

function normalizeSpacingValue(rawValue) {
    const value = rawValue.trim().toLowerCase()
    const remMatch = value.match(/^(-?\d+(?:\.\d+)?)rem$/)
    if (!remMatch) {
        const pxMatch = value.match(/^(-?\d+(?:\.\d+)?)px$/)
        if (!pxMatch) {
            return null
        }

        const numericPx = Number(pxMatch[1])
        if (!Number.isFinite(numericPx)) {
            return null
        }

        if (numericPx === 1) {
            return '1px'
        }

        return `${numericPx / 16}rem`
    }

    const numeric = Number(remMatch[1])
    if (!Number.isFinite(numeric)) {
        return null
    }

    return `${numeric}rem`
}

function normalizeOpacityValue(rawValue) {
    const value = rawValue.trim().toLowerCase()
    if (value.endsWith('%')) {
        const numericPercent = Number(value.slice(0, -1))
        if (Number.isInteger(numericPercent) && numericPercent >= 0 && numericPercent <= 100) {
            return `${numericPercent}`
        }

        return null
    }

    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
        return null
    }

    if (numeric <= 1) {
        const percentage = numeric * 100
        if (Number.isInteger(percentage)) {
            return `${percentage}`
        }

        return null
    }

    if (Number.isInteger(numeric)) {
        return `${numeric}`
    }

    return null
}

function getJsxAttributeText(node, name) {
    const attribute = node.attributes.properties.find((property) => {
        return ts.isJsxAttribute(property) && property.name.text === name
    })

    if (!attribute || !attribute.initializer) {
        return null
    }

    if (ts.isStringLiteral(attribute.initializer)) {
        return attribute.initializer.text
    }

    if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) {
        return null
    }

    if (ts.isStringLiteral(attribute.initializer.expression) || ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression)) {
        return attribute.initializer.expression.text
    }

    return null
}

function getJsxTagName(tagName) {
    if (ts.isIdentifier(tagName)) {
        return tagName.text
    }

    return tagName.getText()
}

function visit(node, cb) {
    cb(node)
    ts.forEachChild(node, (child) => visit(child, cb))
}

function formatLocation(filePath, source, node) {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart())
    return `${relative(filePath)}:${line + 1}`
}

function relative(filePath) {
    return path.relative(root, filePath)
}

function lineAndColumn(text, index) {
    const before = text.slice(0, index)
    const lines = before.split(/\r?\n/)
    return {
        line: lines.length,
        column: lines.at(-1).length + 1,
    }
}

function shouldValidateStringLiteral(node) {
    if (ts.isJsxAttribute(node.parent)) {
        return isCopyAttribute(node.parent)
    }

    if (ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent)) {
        return isCopyAttribute(node.parent.parent)
    }

    return true
}

function isCopyAttribute(attribute) {
    const name = attribute.name?.getText?.() || ''
    return new Set([
        'aria-label',
        'body',
        'description',
        'detail',
        'empty',
        'fallback',
        'label',
        'message',
        'placeholder',
        'subtitle',
        'title',
        'value',
    ]).has(name)
}
