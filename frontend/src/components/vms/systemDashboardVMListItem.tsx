import formatDescription from '@/utils/vms/formatDescription'
import Tag from '../tags/tag'
import smallDate from '@/utils/date/smallDate'
import upperCaseFirstLetter from '@/utils/text/upperCaseFirstLetter'

export default function SystemDashboardVMListItem({ vm }: { vm: VM }) {
    const type = vm.type === 'virtual-machine' ? 'VM' : 'Container'

    return (
        <div className='flex w-full gap-2 rounded-md p-2 hover:bg-bright/3 cursor-pointer items-center'>
            <h1 className='w-full'>{vm.name}</h1>
            <h1 className='w-full'>{vm.owner}</h1>
            <h1 className='min-w-25'>{vm.limits_cpu}</h1>
            <h1 className='min-w-25'>{vm.limits_memory}</h1>
            <h1 className='w-full'>{smallDate(vm.created)}</h1>
            <h1 className='w-full'>{smallDate(vm.last_used)}</h1>
            <h1 className='min-w-25'>{upperCaseFirstLetter(vm.status)}</h1>
            <div className='w-full flex max-w-full flex-wrap gap-1'>
                <Tag color='orange' text={formatDescription(vm.config_image_description)} />
                <Tag color='blue' text={type} />
                <Tag color='blue' icon='pencil' text={String(vm.access_users.length)} />
                <Tag color='green' icon='refresh' text={smallDate(vm.last_checked)} />
                <Tag color='blue' text={vm.device_eth0_ipv4_address} />
            </div>
        </div>
    )
}
