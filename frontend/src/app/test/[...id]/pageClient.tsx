'use client'

import prettyDate from '@/utils/date/prettyDate'
import upperCaseFirstLetter from '@/utils/text/upperCaseFirstLetter'
import { ActivityIcon, Bug, Fingerprint, Hourglass, LinkIcon, Logs, RefreshCw, Timer, Users, Watch, Wifi, WifiOff, Workflow } from 'lucide-react'
import Visits from '@/components/test/visits'
import Content from '@/components/test/content'
import { Dispatch, SetStateAction, useState } from 'react'
import type { ReactNode } from 'react'
import ConnectionStatus from '@/components/test/connectionStatus'

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

    function handleRerun() {
        setTest((prev) => ({
            ...prev,
            status: 'running',
            logs: [],
            errors: [],
            exit_code: 0,
            finished_at: '',
            duration: { milliseconds: 0 },
        }))
        setRerun(true)
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
                rerun={rerun}
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
        <aside className='flex min-h-0 w-full min-w-0 flex-col gap-2 rounded-lg outline-1 outline-dark p-2 md:h-full'>
            <div className='overflow-auto flex-1'>
                <div className='flex flex-wrap justify-between items-center gap-3'>
                    <h1 className='text-lg font-semibold'>Metadata</h1>
                    <div className='flex items-center gap-2'>
                        {isConnected ? (
                            <div className='flex items-center gap-1 text-green-400'>
                                <Wifi className='w-4 h-4' />
                                <span className='text-sm'>Connected</span>
                            </div>
                        ) : (
                            <div className='flex items-center gap-1 text-red-500'>
                                <WifiOff className='w-4 h-4' />
                                <span className='text-sm'>Disconnected</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className='px-px'>
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
                    className='flex w-full min-w-0 gap-2 rounded-lg p-2 text-left hover:bg-dark'
                >
                    <Logs className='h-5 w-5 shrink-0' />
                    <h1 className='min-w-0 break-words'>{showLogs ? 'Hide' : 'Show'} ({test.logs.length}) logs</h1>
                </button>}
                {test.errors.length > 0 && <button
                    onClick={() => setShowErrors(prev => !prev)}
                    className='flex w-full min-w-0 gap-2 rounded-lg bg-red-500/10 p-2 text-left text-red-500 outline-1 outline-red-500/20 hover:bg-red-500/20'
                >
                    <Bug className='h-5 w-5 shrink-0' />
                    <h1 className='min-w-0 break-words'>{showErrors ? 'Hide' : 'Show'} ({test.errors.length}) errors</h1>
                </button>}
            </div>
            <div className='mt-auto'>
                <button
                    onClick={handleRerun}
                    className={`group flex w-full min-w-0 gap-2 rounded-lg p-2 ${rerun
                        ? 'cursor-not-allowed bg-yellow-400/10 outline-1 outline-yellow-400/20 text-yellow-500 hover:bg-yellow-400/15'
                        : 'cursor-pointer bg-blue-400/10 outline-1 outline-blue-400/20 text-blue-500 hover:bg-blue-400/15'
                    }`}
                >
                    {rerun ? <Hourglass className='h-5 w-5 shrink-0 group-hover:stroke-yellow-400/10 ' /> : <RefreshCw className='h-5 w-5 shrink-0 group-hover:stroke-blue-400' />}
                    {rerun ? <h1>Running...</h1> : <h1>Rerun</h1>}
                </button>
            </div>
        </aside>
    )
}

function MetaRow({ icon, value }: { icon: ReactNode, value: ReactNode }) {
    return (
        <div className='flex min-w-0 gap-2 rounded-lg p-2 hover:bg-dark'>
            <span className='grid h-6 w-6 shrink-0 place-items-center [&>svg]:h-5 [&>svg]:w-5'>{icon}</span>
            <h1 className='min-w-0 flex-1 break-words leading-6'>{value}</h1>
        </div>
    )
}
