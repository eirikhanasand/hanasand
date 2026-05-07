import Field from './field'
import ErrorNotice from '@/components/error/errorNotice'

type VMDetailsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    details: VMDetails | null
}

export default function VMNetwork({ boxStyle, boxTitleStyle, vm, details }: VMDetailsProps) {
    void vm

    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Network</h1>
            {details ? <div>
                <Field title='IP' value={details.device_eth0_ipv4_address} />
                <Field title='Interface' value={details.device_eth0_name} />
                <Field title='Interface Type' value={details.device_eth0_type} />
                <Field title='Ephemeral' value={formatFlag(details.ephemeral)} />
                <Field title='Network' value={details.device_eth0_network} />
                <Field title='MAC' value={details.volatile_eth0_hwaddr} />
                <Field title='Profiles' value={details.profiles.join(', ')} />
                <Field title='Stateful' value={formatFlag(details.stateful)} />
            </div> : <ErrorNotice
                compact
                variant='info'
                className='mt-3'
                title='Network details unavailable'
                message='Refresh the VM to try loading IP, interface, and profile details again.'
            />}
        </div>
    )
}

function formatFlag(value: string) {
    if (!value) {
        return 'Unknown'
    }

    const normalized = value.toLowerCase()
    if (normalized === 'true') {
        return 'Yes'
    }

    if (normalized === 'false') {
        return 'No'
    }

    return value
}
