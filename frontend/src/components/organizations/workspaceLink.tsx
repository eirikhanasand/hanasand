'use client'
import Link from 'next/link'
import type { ComponentProps } from 'react'
import { useWorkspace } from './workspaceProvider'
import { cleanWorkspaceUrl, organizationFromParams } from '@/utils/organizations/workspace'
import { hasAppSidebar } from '@/utils/routes/appRoutes'
export default function WorkspaceLink(props: ComponentProps<typeof Link>) {
    const { organizationId } = useWorkspace()
    if (typeof props.href !== 'string') return <Link {...props} />
    const url = new URL(props.href, 'https://hanasand.com')
    if (url.origin !== 'https://hanasand.com' || !hasAppSidebar(url.pathname) || url.pathname.startsWith('/api/')) return <Link {...props} />
    const target = organizationFromParams(url.searchParams)
    const clean = new URL(cleanWorkspaceUrl(props.href), url.origin)
    if (target && target !== organizationId) clean.searchParams.set('org', target)
    return <Link {...props} href={`${clean.pathname}${clean.search}${clean.hash}`} />
}
