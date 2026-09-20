function literalLike(expression: string) {
    return `replace(replace(replace(${expression}, '!', '!!'), '%', '!%'), '_', '!_')`
}

// Trigrams normally discard spaces, so "docker logs" matches index entries
// containing those words anywhere. An alphanumeric stand-in keeps cross-word
// trigrams. The original substring recheck rejects stand-in collisions.
export const logPhraseSearchExpression = 'translate(lower(normalized::text), \' \', \'0\')'

// The index narrows candidates; the original literal substring comparison is
// retained so wildcard characters and database case folding keep their meaning.
export function basicLogSearchPredicate(parameter: string) {
    const literal = literalLike(`translate(lower(${parameter}::text), ' ', '0')`)
    return `(${logPhraseSearchExpression} LIKE '%' || ${literal} || '%' ESCAPE '!' AND strpos(lower(normalized::text), lower(${parameter}::text)) > 0)`
}

export function logFieldTextCandidates(parameter: string) {
    const needle = `lower(${parameter}::text)`
    const encoded = `to_jsonb(${needle})::text`
    // JSON strings escape quotes and control characters. Non-string JSON values
    // extracted as text keep their JSON representation, so retain both forms.
    const fragment = `substring(${encoded} FROM 2 FOR length(${encoded}) - 2)`
    return `(${logPhraseSearchExpression} LIKE '%' || ${literalLike(`translate(${needle}, ' ', '0')`)} || '%' ESCAPE '!' OR ${logPhraseSearchExpression} LIKE '%' || ${literalLike(`translate(${fragment}, ' ', '0')`)} || '%' ESCAPE '!')`
}
