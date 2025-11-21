import smallDate from '@/utils/date/smallDate'
import Field from './field'

type VMDetailsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    details: VMDetails | null
}

export default function VMOverview({ boxStyle, boxTitleStyle, vm, details }: VMDetailsProps) {
    const editors = Array.isArray(vm.access_users) && vm.access_users.length ? vm.access_users.join(', ') : 'Only you'
    const description = details?.description || 'No description'

    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Overview</h1>
            <Field title='Name' value={vm.name} />
            <Field title='Owner' value={vm.owner} />
            <Field title='Created by' value={vm.created_by} />
            <Field title='Created at' value={vm.created} />
            <Field title='Type' value={vm.type} />
            <Field title='Last used' value={smallDate(vm.last_used)} />
            <Field title='Editors' value={editors} />
            <Field title='Description' value={description} />
        </div>
    )
}
