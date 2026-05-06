import TestStatsPageClient from './pageClient'

export default function Page() {
    return (
        <div className='h-[90.5vh] w-full overflow-hidden px-3 py-3 sm:px-5 md:px-8 lg:px-10'>
            <div className='grid h-full w-full spawn overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] shadow-[0_22px_70px_rgba(0,0,0,0.22)]'>
                <TestStatsPageClient />
            </div>
        </div>
    )
}
