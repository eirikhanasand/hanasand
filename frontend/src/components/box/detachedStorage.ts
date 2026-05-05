import type { DetachedBoxShare, DetachedBoxState } from './types'

export const DETACHED_BOX_STORAGE_KEY = 'hanasand.share.detached-request-box.v1'
export const DETACHED_BOX_EVENT = 'hanasand:detached-request-box'

export function loadDetachedBoxState(): DetachedBoxState {
    if (typeof window === 'undefined') {
        return { open: false, share: null }
    }

    try {
        const raw = window.localStorage.getItem(DETACHED_BOX_STORAGE_KEY)
        if (!raw) {
            return { open: false, share: null }
        }

        const parsed = JSON.parse(raw) as Partial<DetachedBoxState>
        return {
            open: Boolean(parsed.open),
            share: parsed.share || null,
        }
    } catch {
        return { open: false, share: null }
    }
}

export function saveDetachedBoxState(state: DetachedBoxState) {
    if (typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(DETACHED_BOX_STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(DETACHED_BOX_EVENT, { detail: state }))
}

export function detachBoxForShare(share: Share | null) {
    const detachedShare: DetachedBoxShare | null = share
        ? {
            id: share.id,
            alias: share.alias,
            path: share.path,
            content: share.content,
            wordCount: share.wordCount,
            estimatedMinutes: share.estimatedMinutes,
            timestamp: share.timestamp,
            git: share.git,
            locked: share.locked,
            owner: share.owner,
            parent: share.parent,
        }
        : null

    saveDetachedBoxState({
        open: true,
        share: detachedShare,
    })
}

export function closeDetachedBox() {
    saveDetachedBoxState({ open: false, share: null })
}
