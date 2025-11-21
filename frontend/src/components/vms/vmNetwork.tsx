import Field from './field'

type VMDetailsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    details: VMDetails | null
}

export default function VMNetwork({ boxStyle, boxTitleStyle, vm, details }: VMDetailsProps) {
    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Network</h1>
            {details ? <div>
                <Field title='IP' value={details.device_eth0_ipv4_address} />
                <Field title='Interface' value={details.device_eth0_name} />
                <Field title='Interface Type' value={details.device_eth0_type} />
                <Field title='Ephemeral' value={`${Boolean(details.ephemeral)}`} />
                <Field title='Network' value={details.device_eth0_network} />
                <Field title='MAC' value={details.volatile_eth0_hwaddr} />
                <Field title='Profiles' value={details.profiles.join(', ')} />
                <Field title='Stateful' value={`${Boolean(details.stateful)}`} />
            </div> : <h1>Unable to get network. Please try again later, refresh the page, or check again using the button in the top right.</h1>}
        </div>
    )
}
