import useClearStateAfter from '@/hooks/useClearStateAfter'
import manageVM from '@/utils/vms/fetch/manage/manage'
import { Play, RefreshCcw, StopCircle } from 'lucide-react'
import { useState } from 'react'
import Notify from '../notify/notify'

export default function RestartButtons({ vm }: { vm: VM }) {
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const [loading, setLoading] = useState(false)
    const isRunning = vm.status.toLowerCase() !== 'stopped'

    async function handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault()
        e.stopPropagation()
    }

    async function handleRestart() {
        setLoading(true)
        const response = await manageVM(vm.name, 'restart')
        setMessage(response)
        setLoading(false)
    }

    async function handleStart() {
        setLoading(true)
        const response = await manageVM(vm.name, 'start')
        setMessage(response)
        setLoading(false)
    }

    async function handleStop() {
        setLoading(true)
        const response = await manageVM(vm.name, 'stop')
        setMessage(response)
        setLoading(false)
    }

    return (
        <div onClick={handleClick} className="hidden group-hover:flex gap-2 h-full rounded-md group cursor-pointer">
            {!isRunning && <button onClick={handleStart} disabled={loading} className="text-green-400 group-hover:cursor-pointer hover:bg-bright/3 px-3 rounded-md">
                <Play className='w-5 h-5' />
            </button>}
            {isRunning && <button onClick={handleRestart} disabled={loading} className="text-blue-400 group-hover:cursor-pointer hover:bg-bright/3 px-3 rounded-md">
                <RefreshCcw className='w-5 h-5' />
            </button>}
            {isRunning && <button onClick={handleStop} disabled={loading} className="text-red-400 group-hover:cursor-pointer hover:bg-bright/3 px-3 rounded-md">
                <StopCircle className='w-5 h-5' />
            </button>}
            <Notify absolute className='px-8' color='bg-blue-500' background='bg-dark/40 outline outline-dark text-bright/80' message={message} />
        </div>
    )
}
