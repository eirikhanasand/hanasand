import { createHmac, timingSafeEqual } from 'node:crypto'

export type GitProvider = 'github' | 'forgejo' | 'gitlab'
export type DevelopmentEntry = { kind: string, externalId: string, title: string, url: string, author: string, state: string, branch: string, updatedAt: string, references: string[] }

export function caseReferences(text: string): string[] {
    return [...new Set([
        ...Array.from(text.matchAll(/(?<![\w-])HA-[1-9]\d*(?![\w-])/g), match => match[0]),
        ...Array.from(text.matchAll(/(?<![\w])case_[a-f0-9]{1,16}(?![\w])/g), match => match[0]),
        ...Array.from(text.matchAll(/\[case:([a-zA-Z0-9_-]{1,200})\]/g), match => match[1]),
    ])].slice(0, 100)
}

export function repositoryUrl(value: string): string {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^\/[^/]+\/.+/.test(url.pathname)) throw new Error('Use the HTTPS repository page URL.')
    return url.origin + url.pathname.replace(/\/$/, '').replace(/\.git$/, '')
}

export function validGitSignature(provider: GitProvider, raw: string, headers: Record<string, unknown>, secret: string): boolean {
    const actual = provider === 'gitlab' ? headers['x-gitlab-token'] : provider === 'github' ? headers['x-hub-signature-256'] : headers['x-forgejo-signature'] || headers['x-gitea-signature']
    const expected = provider === 'gitlab' ? secret : (provider === 'github' ? 'sha256=' : '') + createHmac('sha256', secret).update(raw).digest('hex')
    return typeof actual === 'string' && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

// Provider payloads are untrusted even after signature verification. Build links from the configured repository.
export function developmentEntries(provider: GitProvider, event: string, payload: any, repository: string): DevelopmentEntry[] {
    const receivedRepository = provider === 'gitlab' ? payload.project?.web_url : payload.repository?.html_url
    if (repositoryUrl(String(receivedRepository || '')) !== repository) throw new Error('Repository does not match this integration.')
    const entries: DevelopmentEntry[] = []
    const add = (kind: string, id: unknown, text: unknown, author: unknown, state: string, branch: unknown, at: unknown) => {
        const externalId = String(id || '')
        if (!(kind === 'commit' ? /^[a-f0-9]{40,64}$/i : /^[1-9]\d*$/).test(externalId)) throw new Error('Invalid development identifier.')
        if (typeof text !== 'string' || text.length > 100000 || !Number.isFinite(Date.parse(String(at)))) throw new Error('Invalid development metadata.')
        const path = kind === 'commit' ? (provider === 'gitlab' ? '/-/commit/' : '/commit/') : provider === 'gitlab' ? '/-/merge_requests/' : provider === 'forgejo' ? '/pulls/' : '/pull/'
        entries.push({ kind, externalId, title: text.split('\n')[0].slice(0, 1000), url: repository + path + externalId, author: String(author || 'Unknown').slice(0, 200), state, branch: String(branch || '').slice(0, 500), updatedAt: new Date(String(at)).toISOString(), references: caseReferences(text) })
    }
    if (['push', 'Push Hook', 'Tag Push Hook'].includes(event)) {
        if (!Array.isArray(payload.commits) || payload.commits.length > 2048) throw new Error('Invalid commit list.')
        for (const commit of payload.commits) add('commit', commit.id, commit.message, commit.author?.username || commit.author?.name, 'committed', payload.ref, commit.timestamp)
    } else if (event === 'pull_request' || event === 'Merge Request Hook') {
        const pr = provider === 'gitlab' ? payload.object_attributes : payload.pull_request
        if (!pr) throw new Error('Missing pull or merge request.')
        add(provider === 'gitlab' ? 'merge_request' : 'pull_request', pr.number || pr.iid, `${pr.title || ''}\n${pr.body || pr.description || ''}`, pr.user?.login || payload.user?.username, pr.merged || pr.merged_at || pr.state === 'merged' ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open', pr.head?.ref || pr.source_branch, pr.updated_at)
    }
    return [...new Map(entries.map(entry => [`${entry.kind}:${entry.externalId}`, entry])).values()]
}
