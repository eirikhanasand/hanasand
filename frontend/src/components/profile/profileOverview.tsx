'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Boxes, Building2, Server, Share2 } from 'lucide-react'
import type { ProfileStats } from '@/utils/profile/getProfileStats'

const DAY_MS = 24 * 60 * 60 * 1000
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })

function LoginActivity({ loginDays }: { loginDays: ProfileStats['loginDays'] }) {
    const gridRef = useRef<HTMLDivElement>(null)
    const [weekCount, setWeekCount] = useState(53)
    const today = new Date()
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

    useEffect(() => {
        const grid = gridRef.current
        if (!grid) return
        const observer = new ResizeObserver(([entry]) => {
            const availableWidth = entry.contentRect.width - 32
            setWeekCount(Math.max(1, Math.floor((availableWidth + 3) / 13)))
        })
        observer.observe(grid)
        return () => observer.disconnect()
    }, [])

    const lastWeekStart = new Date(end.getTime() - end.getUTCDay() * DAY_MS)
    const gridStart = new Date(lastWeekStart.getTime() - (weekCount - 1) * 7 * DAY_MS)
    const dayCount = Math.floor((end.getTime() - gridStart.getTime()) / DAY_MS) + 1
    const dates = Array.from({ length: dayCount }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS))
    const weeks = Array.from({ length: weekCount }, (_, week) => dates.slice(week * 7, week * 7 + 7))
    const activity = new Map(loginDays.map(item => [item.day, item.logins]))
    const yearAgo = new Date(end.getTime() - 364 * DAY_MS)
    const recentDays = loginDays.filter(item => item.day >= dateKey(yearAgo) && item.day <= dateKey(end))
    const activeDays = recentDays.length
    const totalLogins = recentDays.reduce((total, item) => total + item.logins, 0)
    const levels = ['bg-ui-raised', 'bg-ui-primary/25', 'bg-ui-primary/45', 'bg-ui-primary/70', 'bg-ui-primary']
    const gridTemplateColumns = `repeat(${weekCount}, 10px)`
    const monthLabels = weeks.map(week => {
        const firstOfMonth = week.find(date => date.getUTCDate() === 1)
        return firstOfMonth ? monthLabel.format(firstOfMonth) : ''
    })

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm shadow-ui-canvas/10 sm:p-5'>
            <div className='flex flex-wrap items-end justify-between gap-x-4 gap-y-1'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Login activity</h2>
                    <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
                        <span className='text-ui-muted'>{activeDays} active days</span>
                        <span aria-hidden='true' className='h-4 border-l border-ui-border' />
                        <span className='text-ui-muted'>{totalLogins} sign-ins in the past year</span>
                    </div>
                </div>
            </div>
            <div className='mt-4 pb-1' ref={gridRef}>
                <div
                    role='group'
                    aria-label={`Login activity from ${dayLabel.format(gridStart)} through ${dayLabel.format(end)}: ${dates.filter(date => activity.has(dateKey(date))).length} days with sign-ins.`}
                    className='w-full'
                >
                    <div className='mb-2 grid h-4 gap-[3px] pl-8 text-[10px] text-ui-muted' style={{ gridTemplateColumns }}>
                        {monthLabels.map((month, index) => <span key={index}>{month}</span>)}
                    </div>
                    <div className='flex gap-2'>
                        <div aria-hidden='true' className='grid w-6 shrink-0 grid-rows-7 gap-[3px] text-[9px] leading-[10px] text-ui-muted'>
                            <span>Sun</span><span></span><span>Tue</span><span></span><span>Thu</span><span></span><span>Sat</span>
                        </div>
                        <div className='grid grid-flow-col grid-rows-7 gap-[3px]' style={{ gridTemplateColumns }}>
                            {weeks.flat().map(date => {
                                const key = dateKey(date)
                                const count = activity.get(key) || 0
                                const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4
                                const label = count
                                    ? `${count} login${count === 1 ? '' : 's'} on ${dayLabel.format(date)}`
                                    : `No logins on ${dayLabel.format(date)}`
                                const cellClass = 'h-2.5 w-2.5 rounded-xs ' + levels[level]
                                return (
                                    <button
                                        key={key}
                                        type='button'
                                        title={label}
                                        aria-label={label}
                                        className={cellClass + ' cursor-default border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-primary'}
                                    />
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <div aria-hidden='true' className='mt-3 flex items-center justify-end gap-1.5 text-[10px] text-ui-muted'>
                <span>Less</span>
                {levels.map((level, index) => <span key={index} className={`h-2.5 w-2.5 rounded-xs ${level}`} />)}
                <span>More</span>
            </div>
        </section>
    )
}

export default function ProfileOverview({ stats }: { stats: ProfileStats | null }) {
    if (!stats) {
        return <p role='status' className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>Profile statistics are unavailable right now.</p>
    }

    const cards = [
        { label: 'Organizations', value: stats.counts.organizations, href: '/organizations', Icon: Building2 },
        { label: 'Containers', value: stats.counts.containers, href: '/vms', Icon: Boxes },
        { label: 'Virtual machines', value: stats.counts.vms, href: '/vms', Icon: Server },
        { label: 'Shares', value: stats.counts.shares, href: '/shares', Icon: Share2 },
        { label: 'Articles', value: stats.counts.articles, href: '/content/articles', Icon: BookOpen },
    ]

    return (
        <div className='grid gap-3'>
            <LoginActivity loginDays={stats.loginDays} />
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5'>
                {cards.map(({ label, value, href, Icon }) => (
                    <Link key={label} href={href} className='group rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm shadow-ui-canvas/10 transition-colors hover:border-ui-primary/50 hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary'>
                        <div className='flex items-center justify-between gap-3'>
                            <span className='text-xs font-medium text-ui-muted'>{label}</span>
                            <Icon aria-hidden='true' className='h-4 w-4 shrink-0 text-ui-muted group-hover:text-ui-primary' />
                        </div>
                        <p className='mt-3 text-2xl font-semibold tabular-nums text-ui-text'>{value.toLocaleString()}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
