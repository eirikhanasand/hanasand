import React from 'react'
import Content from '@/components/content/content'
import getServerSideProps from '@/utils/getTheme'

export default async () => {
    const props = getServerSideProps()
    return (
        <div className="App h-full">
            <h1>theme is {props.theme}</h1>
            <Content />
        </div>
    )
}
