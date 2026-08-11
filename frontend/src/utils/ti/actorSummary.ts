export type ActorSummaryInput = {
    name: string
    aliases?: string[]
    actorClass?: string
    attribution?: string
    targetSectors?: string[]
    geographies?: string[]
    malwareTools?: string[]
}

const unusable = /^(?:no |named threat actor|threat actor profile|observation date|unknown|unavailable)|\b(?:captured public|reviewed|corroborat(?:ed|ion)|evidence is available|source records?)/i

const knownSummaries: Record<string, string> = {
    apt29: 'APT29 is a Russia-linked espionage group associated with targeting governments, research institutes, and think tanks in Europe and NATO countries.',
}

function clean(value: string | undefined) {
    const text = value?.trim().replace(/\s+/g, ' ')
    return text && !unusable.test(text) ? text.replace(/[.。]+$/, '') : ''
}

function list(values: string[] | undefined) {
    return Array.from(new Set((values ?? []).map(value => clean(value)).filter(Boolean))).slice(0, 2)
}

function join(values: string[]) {
    return values.length > 1 ? `${values[0]} and ${values[1]}` : values[0] ?? ''
}

export function actorSummary(input: ActorSummaryInput) {
    const name = input.name.trim() || 'This actor'
    const known = knownSummaries[name.toLowerCase()]
    const attribution = clean(input.attribution)
    const actorClass = clean(input.actorClass)?.toLowerCase().replace(/_/g, ' ')
    const aliases = list(input.aliases).filter(alias => alias.toLowerCase() !== name.toLowerCase())
    const sectors = list(input.targetSectors)
    const geographies = list(input.geographies)
    const tools = list(input.malwareTools)
    if (known && (!attribution || /^observed threat actor$/i.test(attribution))) return known
    let sentence = attribution
        ? attribution.toLowerCase().startsWith(name.toLowerCase()) ? attribution : `${name} is ${attribution}`
        : aliases.length ? `${name} is a threat actor also known as ${join(aliases)}`
            : actorClass && !/cataloged threat group|observed threat actor|unclassified query|named threat actor/.test(actorClass)
                ? `${name} is a ${actorClass}`
                : `${name} is a threat actor identified in the ATT&CK catalog`

    if (sectors.length) sentence += ` targeting ${join(sectors)}`
    if (geographies.length) sentence += `${sectors.length ? ' in' : ' with reported activity in'} ${join(geographies)}`
    if (tools.length && sentence.length < 150) sentence += `, linked to ${join(tools)}`
    return `${sentence}.`
}

export function usefulActorSummary(value: string | undefined) {
    const text = value?.trim().replace(/\s+/g, ' ')
    return text && !unusable.test(text) ? text : ''
}
