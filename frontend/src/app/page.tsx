import React from 'react'
import Content from '@/components/content/content'
import Apps from '@/components/apps/apps'
import Featured from '@/components/featured/featured'
import Articles from '@/components/articles/articles'

export default async function page() {
    return (
        <div>
            <Content />
            <Featured />
            <Articles includeAll={false} max={4} includeRecentTitle={false} />
            <Apps />
        </div>
    )
}
