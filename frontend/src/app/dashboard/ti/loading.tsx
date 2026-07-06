import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default function DashboardTiLoading() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Loading'
                description='Loading collection, recent attacks, actor profiles, sources, and review state.'
            />
            <section className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                    <div className='flex flex-wrap gap-2'>
                        {['Collection', 'Attacks', 'Activity', 'Actors', 'Sources', 'Runs'].map(label => (
                            <div key={label} className='h-[54px] w-28 animate-pulse rounded-lg border border-ui-border bg-ui-panel' />
                        ))}
                    </div>
                </div>
                <div className='grid min-h-[480px] xl:grid-cols-[320px_minmax(0,1fr)_360px]'>
                    <div className='border-b border-ui-border bg-ui-raised p-4 xl:border-b-0 xl:border-r'>
                        <div className='h-10 animate-pulse rounded-lg bg-ui-panel' />
                        <div className='mt-4 grid gap-2'>
                            {Array.from({ length: 7 }).map((_, index) => (
                                <div key={index} className='h-24 animate-pulse rounded-lg bg-ui-panel' />
                            ))}
                        </div>
                    </div>
                    <div className='grid gap-4 p-5'>
                        <div className='h-20 animate-pulse rounded-lg bg-ui-raised' />
                        <div className='h-44 animate-pulse rounded-lg bg-ui-raised' />
                        <div className='h-28 animate-pulse rounded-lg bg-ui-raised' />
                        <div className='grid gap-3 lg:grid-cols-2'>
                            <div className='h-72 animate-pulse rounded-lg bg-ui-raised' />
                            <div className='h-72 animate-pulse rounded-lg bg-ui-raised' />
                        </div>
                    </div>
                    <div className='border-t border-ui-border bg-ui-raised p-4 xl:border-l xl:border-t-0'>
                        <div className='grid gap-4'>
                            <div className='h-44 animate-pulse rounded-lg bg-ui-panel' />
                            <div className='h-44 animate-pulse rounded-lg bg-ui-panel' />
                            <div className='h-44 animate-pulse rounded-lg bg-ui-panel' />
                        </div>
                    </div>
                </div>
            </section>
        </DashboardPage>
    )
}
