import React from 'react'
import Content from '@/components/content/content'
import Apps from '@/components/apps/apps'
import Contact from '@/components/contact/contact'
import Featured from '@/components/featured/featured'
import Articles from '@/components/articles/articles'

export default async function page() {
    return (
        <div className="h-full">
            <Content />
            <Featured />
            <Articles />
            <Apps />
            <Contact />
        </div>
    )
}
