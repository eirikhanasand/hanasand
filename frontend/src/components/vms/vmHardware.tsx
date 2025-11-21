import Field from './field'

type VMDetailsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
}

export default function VMHardware({ boxStyle, boxTitleStyle, vm }: VMDetailsProps) {
    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Hardware</h1>
            <Field title='CPU' value={vm.limits_cpu} />
            <Field title='Memory' value={vm.limits_memory} />
            <Field title='Disk' value={'missing'} />
        </div>
    )
}
