'use client'

import prettyDate from '@/utils/prettyDate'
import upperCaseFirstLetter from '@/utils/text/upperCaseFirstLetter'
import { ActivityIcon, Bug, Fingerprint, Hourglass, LinkIcon, Logs, Timer, Users, Watch, Wifi, WifiOff, Workflow } from 'lucide-react'
import Visits from '@/components/test/visits'
import Content from '@/components/test/content'
import { Dispatch, SetStateAction, useState } from 'react'
import ConnectionStatus from '@/components/test/connectionStatus'

type LeftSideProps = {
    test: Test
    participants: number
    isConnected: boolean
    showLogs: boolean
    setShowLogs: Dispatch<SetStateAction<boolean>>
    showErrors: boolean
    setShowErrors: Dispatch<SetStateAction<boolean>>
}

export default function TestClient({ test: serverTest }: { test: Test }) {
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [showLogs, setShowLogs] = useState(false)
    const [showErrors, setShowErrors] = useState(false)
    const [test, setTest] = useState(serverTest)

    return (
        <>
            <LeftSide
                isConnected={isConnected}
                test={test} participants={participants}
                showLogs={showLogs}
                setShowLogs={setShowLogs}
                showErrors={showErrors}
                setShowErrors={setShowErrors}
            />
            <Content
                test={test}
                setTest={setTest}
                setParticipants={setParticipants}
                setIsConnected={setIsConnected}
                showLogs={showLogs}
                showErrors={showErrors}
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
    setShowErrors
}: LeftSideProps) {
    const ms = test.duration?.milliseconds
    return (
        <div className='p-2 outline-1 outline-dark rounded-lg h-full min-w-[15rem] w-fit space-y-2'>
            <div className='flex justify-between items-center gap-5'>
                <h1 className='text-lg font-semibold'>Metadata</h1>
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <div className="flex items-center gap-1 text-green-400">
                            <Wifi className="w-4 h-4" />
                            <span className="text-sm">Connected</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-red-500">
                            <WifiOff className="w-4 h-4" />
                            <span className="text-sm">Disconnected</span>
                        </div>
                    )}
                </div>
            </div>
            <ConnectionStatus isConnected={isConnected} />
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Users />
                <h1>{participants}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Fingerprint />
                <h1>{test.id}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <LinkIcon />
                <h1>{test.url}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Hourglass />
                <h1>{test.timeout}s</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Timer />
                <h1>{`${ms ? `${ms}ms` : 'Pending'}`}</h1>
            </div>
            <div className='flex gap-2 rounded-rlg hover:bg-dark p-2'>
                <Workflow />
                <h1>{test.stages.default ? 'Default' : JSON.stringify(test.stages)}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <ActivityIcon />
                <h1>{upperCaseFirstLetter(test.status)}</h1>
            </div>
            <Visits id={test.id} serverVisits={test.visits} />
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
                <Watch />
                <h1>{prettyDate(test.created_at)}</h1>
            </div>
            {test.logs.length > 0 && <button 
                onClick={() => setShowLogs(prev => !prev)}
                className='flex gap-2 rounded-lg hover:bg-dark p-2 w-full cursor-pointer'
            >
                <Logs />
                <h1>{showLogs ? 'Hide' : 'Show'} ({test.logs.length}) logs</h1>
            </button>}
            {test.errors.length > 0 && <button 
                onClick={() => setShowErrors(prev => !prev)}
                className='text-red-500 flex gap-2 rounded-lg hover:bg-red-500/20 p-2 w-full cursor-pointer bg-red-500/10 outline-1 outline-red-500/20'
            >
                <Bug />
                <h1>{showErrors ? 'Hide' : 'Show'} ({test.errors.length}) errors</h1>
            </button>}
        </div>
    )
}
