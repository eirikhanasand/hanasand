import TestStatsPageClient from './pageClient'

export default function Page() {
    return (
        <div className='grid min-h-[90.5vh] w-full place-items-center px-4 py-6 sm:px-6 md:px-10 lg:px-16'>
            <div className='grid w-full max-w-6xl spawn rounded-lg overflow-hidden outline outline-dark'>
                <TestStatsPageClient />
            </div>
        </div>
    )
}
