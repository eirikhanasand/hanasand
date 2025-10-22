export default function Contributions() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Des']

    return (
        <table>
            <thead className='text-2xs'>
                <tr className='flex gap-[22px] pl-8'>
                    {months.map((month) => <th key={month}>{month}</th>)}
                </tr>
            </thead>
            <tbody className='flex text-2xs gap-[1px]'>
                <tr className='grid pt-[3px]'>
                    <th>Mon</th>
                    <th>Wed</th>
                    <th>Fri</th>
                </tr>
                <Weeks />
            </tbody>
        </table>
    )
}

function Weeks() {
    const data = []

    function get7Numbers() {
        const numbers = []

        for (let i = 0; i < 7; i++) {
            numbers.push(Math.floor(Math.random() * 20000))
        }

        return numbers
    }
    
    for (let i = 0; i < 52; i++) {
        data.push(<Week data={get7Numbers()} />)
    }

    return data
}

function Week({data}: {data: number[]}) {
    const cells = []
    const cell = 'w-[10px] h-[10px] rounded-sm'

    function getCellColor(value: number): string {
        if (value < 4000) return 'bg-gray-800'
        if (value < 7500) return 'bg-green-900'
        if (value < 12000) return 'bg-green-700'
        if (value < 16000) return 'bg-green-600'
        return 'bg-green-400'
    }

    for (let i = 0; i < 7; i++) {
        cells.push(<th key={i} className={`${cell} ${getCellColor(data[i])}`} />)
    }

    return (
        <tr className='grid space-y-[1px]'>
            {cells}
        </tr>
    )
}
