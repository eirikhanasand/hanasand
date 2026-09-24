export type SiteNetwork = { url: string; ip: string; provider?: string | null; city?: string | null; country?: string | null; country_code?: string | null }

export default function SiteNetworkDetails({ site }: { site?: SiteNetwork }) {
    if (!site?.ip) return null
    const code = site.country_code?.toUpperCase()
    const flag = code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(letter => 127397 + letter.charCodeAt(0))) : null
    return <>
        <span className='text-xs text-ui-muted'>· <a href={`https://www.virustotal.com/gui/ip-address/${encodeURIComponent(site.ip)}`} target='_blank' rel='noopener noreferrer' className='underline-offset-2 hover:underline' aria-label={`${site.ip} on VirusTotal (opens in a new tab)`}>
            {flag ? <span role='img' aria-label={site.country || code} className='mr-1'>{flag}</span> : null}{site.ip}
        </a></span>
        {[site.provider, [site.city, site.country].filter(Boolean).join(', ')].filter(Boolean).map(value => <span key={value} className='text-xs text-ui-muted'>· {value}</span>)}
    </>
}
