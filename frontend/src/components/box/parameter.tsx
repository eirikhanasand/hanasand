import { Dispatch, SetStateAction } from 'react'

type ParameterProps = {
    parameter: string
    value: string
    setParameters: Dispatch<SetStateAction<Parameter[]>>
}

export default function Parameter({ parameter, value, setParameters }: ParameterProps) {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setParameters([])
        // setParameters(e.target.value)
    }

    return (
        <div className='grid grid-cols-2 gap-2'>
            <div className='group'>
                <input
                    className='w-full outline-none'
                    value={parameter}
                    onChange={handleChange}
                />
                <div className='w-full h-px bg-bright/4 group-hover:bg-bright/40' />
            </div>
            <div className='group'>
                <input
                    className='w-full outline-none'
                    value={value}
                    onChange={handleChange}
                />
                <div className='w-full h-px bg-bright/4 group-hover:bg-bright/40' />
            </div>
        </div>
    )
}
