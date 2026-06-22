import TestStatsPageClient from './pageClient'

export default function Page() {
    return (
        <div className='enterprise-console h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-[#f7f8fb] px-3 py-3 text-[#171a21] sm:px-5 md:px-8 lg:px-10'>
            <div className='grid h-full w-full spawn overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-[0_20px_70px_rgba(26,35,55,0.10)]'>
                <TestStatsPageClient />
            </div>
        </div>
    )
}
