'use client'

import { useCallback, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import { getShare } from '@/utils/share/get'
import { getTree } from '@/utils/share/getTree'
import { findTreeFileId } from '../shareTree'

type UseShareWorkspaceStateProps = {
    initialShares: Share[]
}

export function useShareWorkspaceState({ initialShares }: UseShareWorkspaceStateProps) {
    const [shares, setShares] = useState(initialShares)
    const [shareContents, setShareContents] = useState<Record<string, string>>({})
    const [shareTrees, setShareTrees] = useState<Record<string, Tree>>({})
    const [shareFileContents, setShareFileContents] = useState<Record<string, string>>({})

    const hydrateShare = useCallback(async (shareId: string) => {
        const token = getCookie('access_token') || undefined
        const userId = getCookie('id') || undefined
        const share = await getShare({ id: shareId, token, userId })
        if (typeof share === 'string') {
            return null
        }

        setShareContents((prev) => ({ ...prev, [shareId]: share.content }))
        const tree = await getTree({ id: shareId, token, userId })
        if (tree) {
            setShareTrees((prev) => ({ ...prev, [shareId]: tree }))
        }
        return share
    }, [])

    const hydrateShareFile = useCallback(async (rootId: string, filePath: string) => {
        const token = getCookie('access_token') || undefined
        const userId = getCookie('id') || undefined
        const rootTree = shareTrees[rootId] || await getTree({ id: rootId, token, userId })
        if (!rootTree) {
            return null
        }

        setShareTrees((prev) => ({ ...prev, [rootId]: rootTree }))
        const fileId = findTreeFileId(rootTree, filePath)
        if (!fileId) {
            return null
        }

        const share = await getShare({ id: fileId, token, userId })
        if (typeof share === 'string') {
            return null
        }

        const key = `${rootId}:${filePath}`
        setShareFileContents((prev) => ({ ...prev, [key]: share.content }))
        return share.content
    }, [shareTrees])

    const resetShareWorkspaceCache = useCallback((rootId: string) => {
        setShareTrees((prev) => {
            const next = { ...prev }
            delete next[rootId]
            return next
        })
        setShareFileContents((prev) => Object.fromEntries(
            Object.entries(prev).filter(([key]) => !key.startsWith(`${rootId}:`))
        ))
    }, [])

    return {
        shares,
        setShares,
        shareContents,
        setShareContents,
        shareTrees,
        setShareTrees,
        shareFileContents,
        setShareFileContents,
        hydrateShare,
        hydrateShareFile,
        resetShareWorkspaceCache,
    }
}
