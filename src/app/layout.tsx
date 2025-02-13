import React, { ReactNode } from 'react'
import './globals.css'
import Navbar from '@components/nav'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Welcome to my world',
}

export default ({children}: {children: ReactNode}) => {
    return (
        <html lang="en" className='h-full w-full'>
            <body className='h-full'>
                {children}
            </body>
        </html>
    )
}
