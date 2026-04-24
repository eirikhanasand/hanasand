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
        <Link
            href={`/dashboard/vms/${vm.name}`}
            className={`
                group grid min-w-[74rem] items-center gap-2 rounded-md p-2
                text-bright/80 transition hover:bg-bright/3
                lg:grid-cols-[minmax(14rem,1.3fr)_minmax(10rem,1fr)_7rem_10rem_minmax(9rem,0.95fr)_minmax(9rem,0.95fr)_7rem_minmax(16rem,1.4fr)_6.5rem]
            `}
        >
            <h1 className='truncate'>{vm.name}</h1>
            <h1 className='truncate'>{vm.owner}</h1>
            <h1>{metrics ? `${metrics.cpu_usage_percent}%` : vm.limits_cpu}</h1>
            <h1>{metrics ? `${metrics.ram_used_mb}/${metrics.ram_total_mb} MB` : vm.limits_memory}</h1>
            <h1>{smallDate(vm.created)}</h1>
            <h1>{smallDate(vm.last_used)}</h1>
            <h1>{status}</h1>
            <div className='flex max-w-full flex-wrap gap-1'>
                <Tag color='orange' text={formatDescription(vm.config_image_description)} />
                <Tag color='blue' text={type} />
                <Tag color='blue' icon='pencil' text={String(accessUserCount)} />
                <Tag color='green' icon='refresh' text={vm.last_checked ? smallDate(vm.last_checked) : 'Unknown'} />
                <Tag color='blue' text={ipAddress} />
            </div>
            <div className='flex justify-end'>
                <RestartButtons vm={vm} />
            </div>
        </Link>
    )
}
