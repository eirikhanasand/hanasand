import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DatabaseBackup, HardDriveDownload, Mail, RefreshCcw, ShieldCheck } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export default async function BackupPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value

    if (!token) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard/backup%26expired=true')
    }

    return (
        <DashboardPage>
            <DashboardHeader
                title='Backup & Recovery'
                eyebrow='Resilience'
                description='Operational backup coverage, critical state locations, and restore priorities for the Hanasand stack.'
            />

            <div className='grid gap-4 xl:grid-cols-[1.1fr_0.9fr]'>
                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-bright'>Critical data to protect</h2>
                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        <BackupCard
                            icon={<DatabaseBackup className='h-4 w-4' />}
                            title='Postgres volume'
                            body='Primary app data lives in the Docker volume `postgres_data`. Losing it means losing users, sessions, logs, AI conversations, roles, and monitoring history.'
                            detail='Source: docker-compose volume for `postgres`'
                        />
                        <BackupCard
                            icon={<Mail className='h-4 w-4' />}
                            title='Mail state'
                            body='Stalwart keeps mail state in `mail/stalwart`. This should be treated as mailbox data and config that must be snapshotted before risky mail changes.'
                            detail='Source: `./mail/stalwart` bind mount'
                        />
                        <BackupCard
                            icon={<ShieldCheck className='h-4 w-4' />}
                            title='Articles and content'
                            body='The repo ships articles and operational notes directly, so the git remote is also part of the recovery story for content and docs.'
                            detail='Source: repository + article content'
                        />
                        <BackupCard
                            icon={<RefreshCcw className='h-4 w-4' />}
                            title='Runtime topology'
                            body='Compose config, env config, VM metadata, and monitoring checks define how the system comes back after a restore. Keep them versioned and inspectable.'
                            detail='Source: compose, `.env`, and operational scripts'
                        />
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-bright'>Restore priorities</h2>
                    <ol className='mt-4 grid gap-3 text-sm text-bright/72'>
                        <li className='rounded-xl bg-white/4 px-4 py-3'>1. Restore the Postgres volume and confirm the API can read users, sessions, and core content.</li>
                        <li className='rounded-xl bg-white/4 px-4 py-3'>2. Restore mail state so inboxes and account provisioning stay aligned with app users.</li>
                        <li className='rounded-xl bg-white/4 px-4 py-3'>3. Rebuild containers from the repository and verify `/status`, `/dashboard/logs`, and admin routes.</li>
                        <li className='rounded-xl bg-white/4 px-4 py-3'>4. Revalidate Docker socket access, runtime logs, and VM management before calling the environment healthy.</li>
                    </ol>
                </DashboardPanel>
            </div>

            <DashboardPanel className='p-5'>
                <div className='flex items-center gap-2 text-bright'>
                    <HardDriveDownload className='h-4 w-4 text-orange-300' />
                    <h2 className='text-lg font-semibold'>Runbook notes</h2>
                </div>
                <div className='mt-4 grid gap-3 text-sm text-bright/62 md:grid-cols-3'>
                    <RunbookItem title='Database'>
                        Use volume-level snapshots or `pg_dump` before schema-sensitive work. `db/init.sql` is bootstrap only, not a substitute for live data.
                    </RunbookItem>
                    <RunbookItem title='Mail'>
                        Preserve `mail/stalwart` before changing mail topology. The setup script helps bootstrap, but it does not restore mailbox history.
                    </RunbookItem>
                    <RunbookItem title='Verification'>
                        After restore, check auth, monitoring, logs, and the admin surfaces before declaring recovery complete.
                    </RunbookItem>
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function BackupCard({
    icon,
    title,
    body,
    detail,
}: {
    icon: React.ReactNode
    title: string
    body: string
    detail: string
}) {
    return (
        <article className='rounded-2xl bg-white/4 p-4'>
            <div className='flex items-center justify-between text-bright'>
                <h3 className='font-semibold'>{title}</h3>
                <span className='text-orange-300'>{icon}</span>
            </div>
            <p className='mt-3 text-sm leading-6 text-bright/62'>{body}</p>
            <p className='mt-3 text-xs uppercase tracking-[0.18em] text-bright/30'>{detail}</p>
        </article>
    )
}

function RunbookItem({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <article className='rounded-2xl bg-black/18 p-4'>
            <h3 className='font-semibold text-bright'>{title}</h3>
            <p className='mt-2 leading-6'>{children}</p>
        </article>
    )
}
