import type { Metadata } from 'next'
import Content from '@/components/content/content'
import Apps from '@/components/apps/apps'
import Featured from '@/components/featured/featured'
import Articles from '@/components/articles/articles'
import LogoutClient from '@/components/logout/logoutClient'
import { buildRouteMetadata } from './seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand',
    description: 'Portfolio, tools, articles, links, and experiments built by Eirik Hanasand.',
    path: '/',
    keywords: ['hanasand', 'portfolio', 'developer', 'articles', 'tools'],
})

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const logout = Boolean(Array.isArray(params.logout) ? params.logout[0] : params.logout) || false

    return (
        <div className='grid relative px-4 md:px-16'>
            <LogoutClient logoutServer={logout} />
            <Content logout={logout} />
            <Featured />
            <Articles recent={false} max={4} includeRecentTitle={false} />
            <Apps />
        </div>
    )
}
