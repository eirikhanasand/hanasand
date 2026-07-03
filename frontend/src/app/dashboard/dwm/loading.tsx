import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default function DashboardDwmLoading() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Dark web monitoring'
                title='Dark web cases'
                description='Loading recent attacks, evidence, source health, and delivery state.'
            />
            <section className='overflow-hidden rounded-lg border border-[#26344d] bg-[#101827]'>
                <div className='border-b border-[#26344d] bg-[#0b121e] px-4 py-3'>
                    <div className='flex flex-wrap gap-2'>
                        {['Cases', 'Active', 'Critical', 'Ready', 'Watchlist', 'Webhook'].map(label => (
                            <div key={label} className='h-[54px] w-28 animate-pulse rounded-lg border border-[#30415f] bg-[#132033]' />
                        ))}
                    </div>
                </div>
                <div className='grid min-h-[480px] xl:grid-cols-[320px_minmax(0,1fr)_360px]'>
                    <div className='border-b border-[#26344d] bg-[#0b121e] p-4 xl:border-b-0 xl:border-r'>
                        <div className='h-10 animate-pulse rounded-lg bg-[#1a2940]' />
                        <div className='mt-4 grid gap-2'>
                            {Array.from({ length: 7 }).map((_, index) => (
                                <div key={index} className='h-28 animate-pulse rounded-lg bg-[#101827]' />
                            ))}
                        </div>
                    </div>
                    <div className='grid gap-4 p-5'>
                        <div className='h-20 animate-pulse rounded-lg bg-[#0b121e]' />
                        <div className='h-44 animate-pulse rounded-lg bg-[#0b121e]' />
                        <div className='h-28 animate-pulse rounded-lg bg-[#0b121e]' />
                        <div className='grid gap-3 lg:grid-cols-2'>
                            <div className='h-80 animate-pulse rounded-lg bg-[#0b121e]' />
                            <div className='h-80 animate-pulse rounded-lg bg-[#0b121e]' />
                        </div>
                    </div>
                    <div className='border-t border-[#26344d] bg-[#0b121e] p-4 xl:border-l xl:border-t-0'>
                        <div className='grid gap-4'>
                            <div className='h-52 animate-pulse rounded-lg bg-[#101827]' />
                            <div className='h-52 animate-pulse rounded-lg bg-[#101827]' />
                            <div className='h-52 animate-pulse rounded-lg bg-[#101827]' />
                        </div>
                    </div>
                </div>
            </section>
        </DashboardPage>
    )
}
