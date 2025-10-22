import CreateClient from './pageClient'

export default async function Page() {
    return (
        <div className='h-full'>
            <div className='p-16'>
                <CreateClient />
            </div>
        </div>
    )
}
