'use client'

import Line from '../components/line'

// Handles invalid pages
export default function Custom404 (): JSX.Element {
    return (
        <main className="grid place-items-center h-[92vh]">
            <div className='flex place-items-center'>
                <h1 className='text-3xl'>404</h1>
                <Line width={1} height={40} className='mx-4' />
                <h1 className='text-3xl'>This page could not be found.</h1>
            </div>
        </main>
    )
}
