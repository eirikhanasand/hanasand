import React from 'react'
import Content from '@/components/content/content'
import Apps from '@/components/apps/apps'
import Featured from '@/components/featured/featured'
import Articles from '@/components/articles/articles'
import LogoutClient from '@/components/logout/logoutClient'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const logout = Array.isArray(params.logout) ? params.logout[0] : params.logout

    return (
        <div className='grid relative'>
            <LogoutClient logoutServer={logout} />
            <Content />
            <Featured />
            <Articles includeAll={false} max={4} includeRecentTitle={false} />
            <Apps />
        </div>
    )
}
