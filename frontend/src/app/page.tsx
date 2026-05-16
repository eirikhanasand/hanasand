import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ArrowUpRight, CheckCircle2, Code2, Gauge, GitBranch, KeyRound, Link2, LockKeyhole, Rocket, ShieldCheck, Sparkles } from 'lucide-react'
import LogoutClient from '@/components/logout/logoutClient'
import { buildRouteMetadata } from './seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand',
    description: 'Hanasand is a self-hosted AI workspace for building, reviewing, verifying, and deploying small software projects.',
    path: '/',
    keywords: ['hanasand', 'ai workspace', 'self-hosted app builder', 'code review', 'deployment evidence'],
})

const primaryTools = [
    {
        title: 'Production workspace',
        description: 'Open the shared project surface for reviewable work and handoffs.',
        href: '/s',
        icon: Link2,
    },
    {
        title: 'System status',
        description: 'Check service health, latency, and recent incidents.',
        href: '/status',
        icon: Activity,
    },
    {
        title: 'AI assistant',
        description: 'Plan, edit, and verify project work in the AI workspace.',
        href: '/ai',
        icon: Sparkles,
    },
    {
        title: 'Operations dashboard',
        description: 'Review queues, projects, infrastructure, and production activity.',
        href: '/dashboard/overview',
        icon: Gauge,
    },
]

const secondaryLinks = [
    { label: 'Dashboard', href: '/dashboard/overview' },
    { label: 'AI workspace', href: '/ai' },
    { label: 'Service status', href: '/status' },
]

const workflow = [
    {
        title: 'Describe the change',
        detail: 'Start with a goal, repo, or blank workspace and keep the conversation tied to files.',
        icon: Sparkles,
    },
    {
        title: 'Review real edits',
        detail: 'Inspect generated files, apply changes deliberately, and keep handoff context visible.',
        icon: Code2,
    },
    {
        title: 'Verify before release',
        detail: 'Use browser proof, build checks, deploy state, and rollback notes before calling work done.',
        icon: CheckCircle2,
    },
]

const trustSignals = [
    {
        title: 'Self-hosted control',
        detail: 'Designed around portable source, Dockerized services, and explicit production checks.',
        icon: ShieldCheck,
    },
    {
        title: 'Evidence-first workflow',
        detail: 'The product favors visible logs, screenshots, status, and changed files over vague success copy.',
        icon: GitBranch,
    },
    {
        title: 'Deploy-aware handoffs',
        detail: 'Release and recovery context stays close to the workspace instead of disappearing into terminal scrollback.',
        icon: Rocket,
    },
]

const launchFit = [
    {
        label: 'Best for',
        value: 'Technical founders and small teams that want AI speed without giving up source, review, or deployment control.',
    },
    {
        label: 'Replaces',
        value: 'Scattered chat threads, one-off prototypes, manual smoke notes, and terminal-only deploy handoffs.',
    },
    {
        label: 'Requires',
        value: 'A project owner who can connect a repo, model lane, or server target and review generated changes before release.',
    },
    {
        label: 'Not for',
        value: 'Pure no-code buyers who want a hosted template marketplace and never want to inspect files or runtime state.',
    },
]

const operatingRequirements = [
    'Connect a repo, workspace, or server target before relying on deploy handoffs.',
    'Keep at least one model lane or human reviewer available for generated changes.',
    'Run build, browser, and rollback checks before treating AI work as production-ready.',
]

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const logout = Boolean(Array.isArray(params.logout) ? params.logout[0] : params.logout) || false

    return (
        <main className='mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 text-bright md:px-8 md:py-10'>
            <LogoutClient logoutServer={logout} />
            <section className='grid min-h-[calc(100vh-8rem)] content-center gap-8'>
                <div className='max-w-3xl'>
                    <p className='mb-4 text-xs font-medium uppercase tracking-[0.24em] text-bright/38'>Self-hosted AI workspace</p>
                    <h1 className='text-4xl font-semibold text-bright md:text-6xl'>Build, review, verify, deploy.</h1>
                    <p className='mt-5 max-w-2xl text-base leading-7 text-bright/55'>
                        Hanasand keeps AI work tied to source files, browser evidence, deploy state, and handoff history so small software projects can move from prompt to production without losing control.
                    </p>
                    <div className='mt-7 flex flex-wrap gap-3'>
                        <Link href='/s' className='inline-flex items-center gap-2 rounded-lg border border-bright/12 bg-bright/10 px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:bg-bright/14'>
                            Open workspace
                            <ArrowUpRight className='h-4 w-4' />
                        </Link>
                        <Link href='/login' className='inline-flex items-center gap-2 rounded-lg border border-bright/10 px-4 py-2.5 text-sm font-medium text-bright/70 transition-colors hover:bg-bright/8 hover:text-bright'>
                            <KeyRound className='h-4 w-4' />
                            Log in
                        </Link>
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                    {workflow.map((step) => {
                        const Icon = step.icon
                        return (
                            <div key={step.title} className='glass-card rounded-lg p-5'>
                                <div className='grid h-10 w-10 place-items-center rounded-lg bg-[#f07d33]/12 text-orange-200'>
                                    <Icon className='h-4.5 w-4.5' />
                                </div>
                                <h2 className='mt-5 text-base font-medium text-bright'>{step.title}</h2>
                                <p className='mt-2 text-sm leading-6 text-bright/48'>{step.detail}</p>
                            </div>
                        )
                    })}
                </div>

                <div className='grid gap-3 md:grid-cols-2'>
                    {primaryTools.map((tool) => {
                        const Icon = tool.icon
                        return (
                            <Link
                                key={tool.href}
                                href={tool.href}
                                className='group glass-card rounded-lg p-5 transition-colors hover:border-bright/18 hover:bg-bright/8'
                            >
                                <div className='flex items-start justify-between gap-4'>
                                    <div className='grid h-10 w-10 place-items-center rounded-lg bg-bright/8 text-bright/70 transition-colors group-hover:text-bright'>
                                        <Icon className='h-4.5 w-4.5' />
                                    </div>
                                    <ArrowUpRight className='h-4 w-4 text-bright/30 transition-colors group-hover:text-bright/65' />
                                </div>
                                <h2 className='mt-5 text-lg font-medium text-bright'>{tool.title}</h2>
                                <p className='mt-2 max-w-md text-sm leading-6 text-bright/48'>{tool.description}</p>
                            </Link>
                        )
                    })}
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                    {trustSignals.map((signal) => {
                        const Icon = signal.icon
                        return (
                            <div key={signal.title} className='rounded-lg border border-bright/8 px-4 py-3'>
                                <div className='flex items-center gap-2 text-sm font-medium text-bright/80'>
                                    <Icon className='h-4 w-4 text-bright/42' />
                                    {signal.title}
                                </div>
                                <p className='mt-2 text-sm leading-6 text-bright/45'>{signal.detail}</p>
                            </div>
                        )
                    })}
                </div>

                <div className='rounded-lg border border-bright/8 p-5'>
                    <div className='flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-[0.2em] text-bright/38'>Launch fit</p>
                            <h2 className='mt-2 text-xl font-semibold text-bright'>For shipping real software, not just demos.</h2>
                        </div>
                        <p className='max-w-xl text-sm leading-6 text-bright/48'>
                            Hanasand is strongest when teams need the AI workspace, editor, status surface, and deploy evidence in one self-hosted loop.
                        </p>
                    </div>
                    <div className='mt-5 grid gap-3 md:grid-cols-2'>
                        {launchFit.map((item) => (
                            <div key={item.label} className='rounded-lg bg-bright/[0.035] px-4 py-3'>
                                <div className='text-[11px] font-medium uppercase tracking-[0.16em] text-bright/36'>{item.label}</div>
                                <p className='mt-2 text-sm leading-6 text-bright/58'>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className='mt-4 rounded-lg border border-bright/8 bg-background/30 px-4 py-3'>
                        <div className='text-[11px] font-medium uppercase tracking-[0.16em] text-bright/36'>Operating checklist</div>
                        <div className='mt-3 grid gap-2 md:grid-cols-3'>
                            {operatingRequirements.map((item) => (
                                <div key={item} className='flex min-w-0 items-start gap-2 text-sm leading-6 text-bright/52'>
                                    <CheckCircle2 className='mt-1 h-3.5 w-3.5 shrink-0 text-[#f07d33]/80' />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='flex flex-wrap items-center gap-2 text-sm text-bright/45'>
                    <LockKeyhole className='h-4 w-4' />
                    {secondaryLinks.map((link) => (
                        <Link key={link.href} href={link.href} className='rounded-lg px-3 py-1.5 transition-colors hover:bg-bright/8 hover:text-bright/75'>
                            {link.label}
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    )
}
