'use client'

import prettyDate from '@/utils/prettyDate'
import upperCaseFirstLetter from '@/utils/text/upperCaseFirstLetter'
import { ActivityIcon, Fingerprint, LinkIcon, Timer, Users, Watch, Wifi, WifiOff, Workflow } from 'lucide-react'
import Visits from '@/components/test/visits'
import Content from '@/components/test/content'
import { useState } from 'react'
import ConnectionStatus from '@/components/test/connectionStatus'

type LeftSideProps = {
    test: Test
    participants: number
    isConnected: boolean
}

export default function TestClient({ test }: { test: Test }) {
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)

    return (
        <>
            <LeftSide isConnected={isConnected} test={test} participants={participants} />
            <Content
                test={test}
                setParticipants={setParticipants}
                setIsConnected={setIsConnected}
            />
        </>
    )
}

function LeftSide({ test, participants, isConnected }: LeftSideProps) {
    return (
        <div className='p-2 outline-1 outline-dark rounded-lg h-full grid gap-2'>
            <div className='flex justify-between items-center px-2'>
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
                <Timer />
                <h1>{test.timeout}</h1>
            </div>
            <div className='flex gap-2 rounded-lg hover:bg-dark p-2'>
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
        </div>
    )
}