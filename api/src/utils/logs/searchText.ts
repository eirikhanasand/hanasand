// The index narrows candidates; the original literal substring comparison is
// retained so wildcard characters and database case folding keep their meaning.
export function basicLogSearchPredicate(parameter: string) {
    const literal = `replace(replace(replace(lower(${parameter}::text), '!', '!!'), '%', '!%'), '_', '!_')`
    return `(lower(normalized::text) LIKE '%' || ${literal} || '%' ESCAPE '!' AND strpos(lower(normalized::text), lower(${parameter}::text)) > 0)`
}
