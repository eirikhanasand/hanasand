import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default function DashboardDwmLoading() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Dark web monitoring'
                title='Exposure workbench'
                description='Loading queue, evidence, source posture, and delivery state.'
            />
            <section className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white'>
                <div className='border-b border-[#e8edf5] bg-[#171a21] px-4 py-3'>
                    <div className='flex flex-wrap gap-2'>
                        {['Cases', 'Active', 'Critical', 'Ready', 'Watchlist', 'Webhook'].map(label => (
                            <div key={label} className='h-[54px] w-28 animate-pulse rounded-lg border border-white/10 bg-white/10' />
                        ))}
                    </div>
                </div>
                <div className='grid min-h-[640px] xl:grid-cols-[320px_minmax(0,1fr)_360px]'>
                    <div className='border-b border-[#e8edf5] bg-[#f8fafc] p-4 xl:border-b-0 xl:border-r'>
                        <div className='h-10 animate-pulse rounded-lg bg-[#e8edf5]' />
                        <div className='mt-4 grid gap-2'>
                            {Array.from({ length: 7 }).map((_, index) => (
                                <div key={index} className='h-28 animate-pulse rounded-lg bg-white' />
                            ))}
                        </div>
                    </div>
                    <div className='grid gap-4 p-5'>
                        <div className='h-20 animate-pulse rounded-lg bg-[#eef1f5]' />
                        <div className='h-44 animate-pulse rounded-lg bg-[#f3f6fa]' />
                        <div className='h-28 animate-pulse rounded-lg bg-[#f3f6fa]' />
                        <div className='grid gap-3 lg:grid-cols-2'>
                            <div className='h-80 animate-pulse rounded-lg bg-[#f3f6fa]' />
                            <div className='h-80 animate-pulse rounded-lg bg-[#f3f6fa]' />
                        </div>
                    </div>
                    <div className='border-t border-[#e8edf5] bg-[#fbfcfe] p-4 xl:border-l xl:border-t-0'>
                        <div className='grid gap-4'>
                            <div className='h-52 animate-pulse rounded-lg bg-white' />
                            <div className='h-52 animate-pulse rounded-lg bg-white' />
                            <div className='h-52 animate-pulse rounded-lg bg-white' />
                        </div>
                    </div>
                </div>
            </section>
        </DashboardPage>
    )
}
