import Field from './field'

type VMDetailsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    details: VMDetails | null
}

export default function VMDetails({ boxStyle, boxTitleStyle, vm, details }: VMDetailsProps) {
    const uniquePowerState = vm.status !== details?.volatile_last_state_power
    const uniqueGeneration = details?.volatile_uuid !== details?.volatile_uuid_generation
    const uniqueArchitecture = details?.architecture !== details?.config_architecture

    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Details</h1>
            {details ? <div>
                <Field title='Status' value={vm.status} />
                {uniquePowerState && <Field title='Last power state' value={details.volatile_last_state_power} />}
                <Field title='Operating System (OS)' value={`${details.config_image_os} ${details.config_image_version}`} />
                <Field title='Config Image Release' value={details.config_image_release} />
                <Field title='Config Image serial' value={details.config_image_serial} />
                <Field title='Config Image Type' value={details.config_image_type} />
                <Field title='Config Image Description' value={details.config_image_description} />
                <Field title='Config Image Architecture' value={details.config_image_architecture} />
                <Field title='Config Image Label' value={details.config_image_label} />
                <Field title='Base image' value={details.volatile_base_image} />
                <Field title='Cloud Init Instance ID' value={details.volatile_cloud_init_instance_id} />
                <Field title='UUID' value={details.volatile_uuid} />
                {uniqueGeneration && <Field title='UUID Generation' value={details.volatile_uuid_generation} />}
                <Field title='Virtual Socket ID' value={details.volatile_vsock_id} />
                <Field title='Architecture' value={details.architecture} />
                {uniqueArchitecture && <Field title='Config Architecture' value={details.config_architecture} />}
            </div> : <h1>Unable to get details. Please try again later, refresh the page, or check again using the button in the top right.'</h1>}
        </div>
    )
}
