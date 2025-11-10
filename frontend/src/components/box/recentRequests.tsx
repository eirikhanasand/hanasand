import { useState } from 'react'
import RecentRequest from './recentRequest'
import exampleRequests from './boxExamples'

export default function RecentRequests() {
    const [recentRequests, setRecentRequests] = useState<FetchRequest[]>(exampleRequests)

    return (
        <div className='h-full max-h-full overflow-auto'>
            {recentRequests.map((req, id) => <RecentRequest key={id} req={req} />)}
        </div>
    )
}
