export default function Contributions() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Des']

    return (
        <table>
            <thead className='text-2xs'>
                <tr className='flex gap-[22px] pl-8'>
                    {months.map((month) => <th key={month}>{month}</th>)}
                </tr>
            </thead>
            <tbody className='flex text-2xs gap-px'>
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
        data.push(<Week key={i} data={get7Numbers()} />)
    }

    return data
}

function Week({data}: {data: number[]}) {
    const cells = []
    const cell = 'h-2.5 w-2.5 rounded-sm'

    function getCellColor(value: number): string {
        if (value < 4000) return 'bg-ui-border'
        if (value < 7500) return 'bg-ui-success/25'
        if (value < 12000) return 'bg-ui-success/45'
        if (value < 16000) return 'bg-ui-success/70'
        return 'bg-ui-success'
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
