import { LayoutDashboard } from 'lucide-react'
import LinkorDiv from '../misc/linkOrDiv'

export default function Dashboard({ href }: { href?: string }) {
    return (
        <LinkorDiv href={href} className='group rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center'>
            <LayoutDashboard className='stroke-current group-hover:stroke-[#374c66]' />
        </LinkorDiv>
    )
}
