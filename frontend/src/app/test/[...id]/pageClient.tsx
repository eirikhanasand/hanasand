'use client'

import prettyDate from '@/utils/date/prettyDate'
import upperCaseFirstLetter from '@/utils/text/upperCaseFirstLetter'
import { ActivityIcon, Bug, Fingerprint, Hourglass, LinkIcon, Logs, RefreshCw, Timer, Users, Watch, Wifi, WifiOff, Workflow } from 'lucide-react'
import Visits from '@/components/test/visits'
import Content from '@/components/test/content'
import { Dispatch, SetStateAction, useState } from 'react'
import type { ReactNode } from 'react'
import ConnectionStatus from '@/components/test/connectionStatus'
import { rerunTest } from '@/utils/test/rerunTest'

type LeftSideProps = {
    test: Test
    participants: number
    isConnected: boolean
    showLogs: boolean
    setShowLogs: Dispatch<SetStateAction<boolean>>
    showErrors: boolean
    setShowErrors: Dispatch<SetStateAction<boolean>>
    rerun: boolean
    onRerun: () => void
}

export default function TestClient({ test: serverTest }: { test: Test }) {
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [showLogs, setShowLogs] = useState(true)
    const [showErrors, setShowErrors] = useState(false)
    const [test, setTest] = useState(serverTest)
    const [rerun, setRerun] = useState(false)

    async function handleRerun() {
        if (rerun) {
            return
        }

        setRerun(true)
        setTest((prev) => ({
            ...prev,
            status: 'running',
            logs: [],
            errors: [],
            exit_code: 0,
            finished_at: '',
            duration: { milliseconds: 0 },
        }))

        try {
            await rerunTest(test.id)
        } catch {
            setRerun(false)
            setTest((prev) => ({
                ...prev,
                status: serverTest.status,
            }))
        }
    }

    return (
        <>
            <LeftSide
                isConnected={isConnected}
                test={test} participants={participants}
                showLogs={showLogs}
                setShowLogs={setShowLogs}
                showErrors={showErrors}
                setShowErrors={setShowErrors}
                rerun={rerun}
                onRerun={handleRerun}
            />
            <Content
                test={test}
                setTest={setTest}
                setParticipants={setParticipants}
                setIsConnected={setIsConnected}
                showLogs={showLogs}
                showErrors={showErrors}
                setRerun={setRerun}
            />
        </>
    )
}

function LeftSide({
    test,
    participants,
    isConnected,
    showLogs,
    setShowLogs,
    showErrors,
    setShowErrors,
    rerun,
    onRerun
}: LeftSideProps) {
    const ms = test.duration?.milliseconds

    function handleRerun() {
        if (!rerun) {
            onRerun()
        }
    }

    return (
        <aside className='flex min-h-0 w-full min-w-0 flex-col gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm md:h-full'>
            <div className='flex-1 overflow-auto pr-1'>
                <div className='flex flex-wrap items-start justify-between gap-3 border-b border-ui-border pb-3'>
                    <div>
                        <h1 className='text-base font-semibold text-ui-text'>Check details</h1>
                        <p className='mt-1 text-xs leading-5 text-ui-muted'>Live status, target, and recent activity.</p>
                    </div>
                    <div className='flex items-center gap-2'>
                        {isConnected ? (
                            <div className='flex h-8 items-center gap-1.5 rounded-lg border border-ui-success/30 bg-ui-success/10 px-2.5 text-ui-success'>
                                <Wifi className='h-4 w-4' />
                                <span className='text-xs font-medium'>Connected</span>
                            </div>
                        ) : (
                            <div className='flex h-8 items-center gap-1.5 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-2.5 text-ui-warning'>
                                <WifiOff className='h-4 w-4' />
                                <span className='text-xs font-medium'>Offline</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className='mt-3 px-px'>
                    <ConnectionStatus isConnected={isConnected} />
                </div>
                <div className='mt-3 grid gap-1'>
                    <MetaRow icon={<Users />} label='Viewers' value={participants} />
                    <MetaRow icon={<Fingerprint />} label='Scan id' value={test.id} />
                    <MetaRow icon={<LinkIcon />} label='Target' value={test.url} />
                    <MetaRow icon={<Hourglass />} label='Timeout' value={`${test.timeout}s`} />
                    <MetaRow icon={<Timer />} label='Duration' value={`${ms ? `${ms}ms` : 'Pending'}`} />
                    <MetaRow icon={<Workflow />} label='Stages' value={test.stages.default ? 'Default' : JSON.stringify(test.stages)} />
                    <MetaRow icon={<ActivityIcon />} label='Status' value={upperCaseFirstLetter(test.status)} />
                </div>
                <Visits id={test.id} serverVisits={test.visits} />
                <MetaRow icon={<Watch />} label='Created' value={prettyDate(test.created_at)} />
                {test.logs.length > 0 && <button
                    onClick={() => setShowLogs(prev => !prev)}
                    className='flex w-full min-w-0 items-center gap-2 rounded-lg p-2 text-left text-ui-text transition hover:bg-ui-raised'
                >
                    <Logs className='h-4 w-4 shrink-0 text-ui-muted' />
                    <span className='min-w-0 wrap-break-word text-sm'>{showLogs ? 'Hide' : 'Show'} ({test.logs.length}) logs</span>
                </button>}
                {test.errors.length > 0 && <button
                    onClick={() => setShowErrors(prev => !prev)}
                    className='flex w-full min-w-0 items-center gap-2 rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-2 text-left text-ui-danger transition hover:bg-ui-danger/15'
                >
                    <Bug className='h-4 w-4 shrink-0' />
                    <span className='min-w-0 wrap-break-word text-sm'>{showErrors ? 'Hide' : 'Show'} ({test.errors.length}) errors</span>
                </button>}
            </div>
            <div className='mt-auto'>
                <button
                    onClick={handleRerun}
                    className={`group flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition ${rerun
                        ? 'cursor-not-allowed border border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                        : 'cursor-pointer border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'
                    }`}
                >
                    {rerun ? <Hourglass className='h-4 w-4 shrink-0' /> : <RefreshCw className='h-4 w-4 shrink-0' />}
                    {rerun ? <span>Running...</span> : <span>Rerun</span>}
                </button>
            </div>
        </aside>
    )
}

function MetaRow({ icon, label, value }: { icon: ReactNode, label: string, value: ReactNode }) {
    return (
        <div className='grid min-w-0 grid-cols-[1.25rem_minmax(4.75rem,0.35fr)_minmax(0,1fr)] items-start gap-2 rounded-lg p-2 text-sm text-ui-text transition hover:bg-ui-raised'>
            <span className='grid h-5 w-5 shrink-0 place-items-center text-ui-muted [&>svg]:h-4 [&>svg]:w-4'>{icon}</span>
            <span className='text-xs font-semibold uppercase leading-5 text-ui-muted'>{label}</span>
            <span className='min-w-0 flex-1 wrap-break-word leading-5'>{value}</span>
        </div>
    )
}
