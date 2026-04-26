import TestStatsPageClient from './pageClient'

export default function Page() {
    return (
        <div className='h-[90.5vh] w-full overflow-hidden px-3 py-3 sm:px-5 md:px-8 lg:px-12'>
            <div className='grid h-full w-full spawn overflow-hidden rounded-lg outline outline-dark'>
                <TestStatsPageClient />
            </div>
        </div>
    )
}
