import useClearStateAfter from '@/hooks/useClearStateAfter'
import manageVM from '@/utils/vms/fetch/manage/manage'
import { Play, RefreshCcw, StopCircle } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Notify from '../notify/notify'

export default function RestartButtons({ vm, forceVisible = false }: { vm: VM, forceVisible?: boolean }) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const [loading, setLoading] = useState(false)
    const status = (vm.status || '').toLowerCase()
    const isRunning = status !== '' && status !== 'stopped'

    async function handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault()
        e.stopPropagation()
    }

    async function handleRestart() {
        setLoading(true)
        const response = await manageVM(vm.name, 'restart')
        setMessage(response)
        if (response && !response.toLowerCase().includes('failed') && !response.toLowerCase().includes('error')) {
            router.refresh()
        }
        setLoading(false)
    }

    async function handleStart() {
        setLoading(true)
        const response = await manageVM(vm.name, 'start')
        setMessage(response)
        if (response && !response.toLowerCase().includes('failed') && !response.toLowerCase().includes('error')) {
            router.refresh()
        }
        setLoading(false)
    }

    async function handleStop() {
        setLoading(true)
        const response = await manageVM(vm.name, 'stop')
        setMessage(response)
        if (response && !response.toLowerCase().includes('failed') && !response.toLowerCase().includes('error')) {
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <div onClick={handleClick} className={`${forceVisible ? 'flex' : 'hidden group-hover:flex'} h-9 items-center justify-end gap-1 rounded-md group cursor-pointer`}>
            {!isRunning && <button onClick={handleStart} disabled={loading} className="grid h-9 w-9 place-items-center rounded-md text-green-400 group-hover:cursor-pointer hover:bg-bright/3">
                <Play className='w-5 h-5' />
            </button>}
            {isRunning && <button onClick={handleRestart} disabled={loading} className="grid h-9 w-9 place-items-center rounded-md text-blue-400 group-hover:cursor-pointer hover:bg-bright/3">
                <RefreshCcw className='w-5 h-5' />
            </button>}
            {isRunning && <button onClick={handleStop} disabled={loading} className="grid h-9 w-9 place-items-center rounded-md text-red-400 group-hover:cursor-pointer hover:bg-bright/3">
                <StopCircle className='w-5 h-5' />
            </button>}
            <Notify absolute className='px-8' color='bg-blue-500' background='bg-dark/40 outline outline-dark text-bright/80' message={message} />
        </div>
    )
}
