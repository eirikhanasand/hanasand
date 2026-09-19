function literalLike(expression: string) {
    return `replace(replace(replace(${expression}, '!', '!!'), '%', '!%'), '_', '!_')`
}

// The index narrows candidates; the original literal substring comparison is
// retained so wildcard characters and database case folding keep their meaning.
export function basicLogSearchPredicate(parameter: string) {
    const literal = literalLike(`lower(${parameter}::text)`)
    return `(lower(normalized::text) LIKE '%' || ${literal} || '%' ESCAPE '!' AND strpos(lower(normalized::text), lower(${parameter}::text)) > 0)`
}

export function logFieldTextCandidates(parameter: string) {
    const needle = `lower(${parameter}::text)`
    const encoded = `to_jsonb(${needle})::text`
    // JSON strings escape quotes and control characters. Non-string JSON values
    // extracted as text keep their JSON representation, so retain both forms.
    const fragment = `substring(${encoded} FROM 2 FOR length(${encoded}) - 2)`
    return `(lower(normalized::text) LIKE '%' || ${literalLike(needle)} || '%' ESCAPE '!' OR lower(normalized::text) LIKE '%' || ${literalLike(fragment)} || '%' ESCAPE '!')`
}
