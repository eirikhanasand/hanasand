import { useState } from 'react'
import requestColor from './requestColor'
import Parameter from './parameter'
import { exampleParameters } from './boxExamples'

export default function NewRequest() {
    const [type, setType] = useState('get')
    const [path, setPath] = useState('')
    const [parameters, setParameters] = useState<Parameter[]>(exampleParameters)
    const typeColor = requestColor(type)


    function send(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.preventDefault()
    }

    return (
        <div className='w-full'>
            {/* øverste div */}
            <div className='w-full mt-1 grid gap-3'>
                {/* send div */}
                <form className='flex justify-between items-center w-full gap-2'>
                    <div className='flex gap-2 w-full'>
                        <div className={`bg-bright/5 font-semibold text-bright/80 rounded-lg px-4 py-1`}>
                            <h1>{type.toUpperCase()}</h1>
                        </div>
                        <input
                            className='w-full outline outline-dark rounded-lg px-2'
                            placeholder='https://hanasand.com'
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            required
                        />
                    </div>
                    <button onClick={send} className='bg-bright/5 rounded-lg px-8 py-1 cursor-pointer'>
                        <h1>Send</h1>
                    </button>
                </form>
                <div className='flex gap-2 font-medium text-bright/80 px-1'>
                    <h1 className='cursor-pointer'>Query</h1>
                    <h1 className='cursor-pointer'>Headers</h1>
                    <h1 className='cursor-pointer'>Auth</h1>
                    <h1 className='cursor-pointer'>Body</h1>
                    <h1 className='cursor-pointer'>Tests</h1>
                    <h1 className='cursor-pointer'>Pre Run</h1>
                    {/* query, headers etc div */}
                </div>
            </div>
            <div className='w-full h-[1.5px] mt-1 bg-bright/18 rounded-lg' />
            {/* edit query params div */}
            <div className='p-1'>
                {parameters.map(((p, id) => <Parameter
                    key={id}
                    parameter={p.parameter}
                    value={p.value}
                    setParameters={setParameters}
                    />))}
            </div>

            {/* response div */}
            <div className='mt-6'>
                {/* øverste div */}
                <div>
                    {/* returnkode / stats div */}
                    <div className='grid gap-2'>
                        <div className='flex gap-4'>
                            <div className='font-semibold flex gap-1 items-center'>
                                <h1>Status:</h1>
                                <h1 className='text-green-500'>200 OK</h1>
                            </div>
                            <div className='font-semibold flex gap-1 items-center'>
                                <h1>Size:</h1>
                                <h1 className='text-green-500'>36.61 KB</h1>
                            </div>
                            <div className='font-semibold flex gap-1 items-center'>
                                <h1>Time:</h1>
                                <h1 className='text-green-500'>475 ms</h1>
                            </div>
                        </div>
                        <div className='flex gap-2 font-medium text-bright/80'>
                            <h1 className='cursor-pointer'>Response</h1>
                            <h1 className='cursor-pointer'>Headers</h1>
                            <h1 className='cursor-pointer'>Auth</h1>
                            <h1 className='cursor-pointer'>Cookies</h1>
                            <h1 className='cursor-pointer'>Results</h1>
                            <h1 className='cursor-pointer'>Docs</h1>
                            {/* query, headers etc div */}
                        </div>
                    </div>
                    <div className='w-full h-[1.5px] my-1 bg-bright/18 rounded-lg' />
                    {/* innhold div */}
                    <div>
                        <h1 className='text-bright/70'>OK</h1>
                    </div>
                </div>
            </div>
        </div>
    )
}
