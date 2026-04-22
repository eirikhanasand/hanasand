import formatDescription from '@/utils/vms/formatDescription'
import Tag from '../tags/tag'
import smallDate from '@/utils/date/smallDate'
import upperCaseFirstLetter from '@/utils/text/upperCaseFirstLetter'
import Link from 'next/link'
import RestartButtons from './restartButtons'

export default function SystemDashboardVMListItem({ vm, metrics }: { vm: VM; metrics?: VMMetrics }) {
    const type = vm.type === 'virtual-machine' ? 'VM' : 'Container'
    const status = vm.status ? upperCaseFirstLetter(vm.status) : 'Unknown'
    const accessUserCount = Array.isArray(vm.access_users) ? vm.access_users.length : 0
    const ipAddress = vm.device_eth0_ipv4_address || 'No IPv4'

    return (
        <Link href={`/dashboard/vms/${vm.name}`} className='group flex w-full gap-2 rounded-md p-2 hover:bg-bright/3 cursor-pointer items-center text-bright/80'>
            <h1 className='w-full'>{vm.name}</h1>
            <h1 className='w-full'>{vm.owner}</h1>
            <h1 className='min-w-25'>{metrics ? `${metrics.cpu_usage_percent}%` : vm.limits_cpu}</h1>
            <h1 className='min-w-25'>{metrics ? `${metrics.ram_used_mb}/${metrics.ram_total_mb} MB` : vm.limits_memory}</h1>
            <h1 className='w-full'>{smallDate(vm.created)}</h1>
            <h1 className='w-full'>{smallDate(vm.last_used)}</h1>
            <h1 className='min-w-25'>{status}</h1>
            <div className='w-full flex max-w-full flex-wrap gap-1'>
                <Tag color='orange' text={formatDescription(vm.config_image_description)} />
                <Tag color='blue' text={type} />
                <Tag color='blue' icon='pencil' text={String(accessUserCount)} />
                <Tag color='green' icon='refresh' text={vm.last_checked ? smallDate(vm.last_checked) : 'Unknown'} />
                <Tag color='blue' text={ipAddress} />
            </div>
            <div className='flex min-w-24 justify-end'>
                <RestartButtons vm={vm} />
            </div>
        </Link>
    )
}
