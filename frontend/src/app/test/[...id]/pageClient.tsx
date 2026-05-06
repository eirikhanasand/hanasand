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
        <aside className='flex min-h-0 w-full min-w-0 flex-col gap-3 rounded-lg border border-white/10 bg-white/3 p-3 md:h-full'>
            <div className='flex-1 overflow-auto pr-1'>
                <div className='flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-3'>
                    <div>
                        <h1 className='text-base font-medium text-bright/92'>Run metadata</h1>
                        <p className='mt-1 text-xs leading-5 text-bright/44'>Live status, configuration, and recent activity.</p>
                    </div>
                    <div className='flex items-center gap-2'>
                        {isConnected ? (
                            <div className='flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300/15 bg-emerald-300/8 px-2.5 text-emerald-200/80'>
                                <Wifi className='h-4 w-4' />
                                <span className='text-xs font-medium'>Connected</span>
                            </div>
                        ) : (
                            <div className='flex h-8 items-center gap-1.5 rounded-lg border border-orange-300/15 bg-orange-300/8 px-2.5 text-orange-200/80'>
                                <WifiOff className='h-4 w-4' />
                                <span className='text-xs font-medium'>Offline</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className='mt-3 px-px'>
                    <ConnectionStatus isConnected={isConnected} />
                </div>
                <MetaRow icon={<Users />} value={participants} />
                <MetaRow icon={<Fingerprint />} value={test.id} />
                <MetaRow icon={<LinkIcon />} value={test.url} />
                <MetaRow icon={<Hourglass />} value={`${test.timeout}s`} />
                <MetaRow icon={<Timer />} value={`${ms ? `${ms}ms` : 'Pending'}`} />
                <MetaRow icon={<Workflow />} value={test.stages.default ? 'Default' : JSON.stringify(test.stages)} />
                <MetaRow icon={<ActivityIcon />} value={upperCaseFirstLetter(test.status)} />
                <Visits id={test.id} serverVisits={test.visits} />
                <MetaRow icon={<Watch />} value={prettyDate(test.created_at)} />
                {test.logs.length > 0 && <button
                    onClick={() => setShowLogs(prev => !prev)}
                    className='flex w-full min-w-0 items-center gap-2 rounded-lg p-2 text-left text-bright/68 transition hover:bg-white/[0.055]'
                >
                    <Logs className='h-4 w-4 shrink-0 text-bright/42' />
                    <span className='min-w-0 wrap-break-word text-sm'>{showLogs ? 'Hide' : 'Show'} ({test.logs.length}) logs</span>
                </button>}
                {test.errors.length > 0 && <button
                    onClick={() => setShowErrors(prev => !prev)}
                    className='flex w-full min-w-0 items-center gap-2 rounded-lg border border-red-300/15 bg-red-300/8 p-2 text-left text-red-200/78 transition hover:bg-red-300/12'
                >
                    <Bug className='h-4 w-4 shrink-0' />
                    <span className='min-w-0 wrap-break-word text-sm'>{showErrors ? 'Hide' : 'Show'} ({test.errors.length}) errors</span>
                </button>}
            </div>
            <div className='mt-auto'>
                <button
                    onClick={handleRerun}
                    className={`group flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition ${rerun
                        ? 'cursor-not-allowed border border-yellow-300/15 bg-yellow-300/8 text-yellow-100/72'
                        : 'cursor-pointer border border-white/10 bg-white/[0.055] text-bright/78 hover:bg-white/[0.075]'
                    }`}
                >
                    {rerun ? <Hourglass className='h-4 w-4 shrink-0' /> : <RefreshCw className='h-4 w-4 shrink-0' />}
                    {rerun ? <span>Running...</span> : <span>Rerun</span>}
                </button>
            </div>
        </aside>
    )
}

function MetaRow({ icon, value }: { icon: ReactNode, value: ReactNode }) {
    return (
        <div className='flex min-w-0 gap-2 rounded-lg p-2 text-sm text-bright/66 transition hover:bg-white/[0.045]'>
            <span className='grid h-5 w-5 shrink-0 place-items-center text-bright/42 [&>svg]:h-4 [&>svg]:w-4'>{icon}</span>
            <span className='min-w-0 flex-1 wrap-break-word leading-5'>{value}</span>
        </div>
    )
}
