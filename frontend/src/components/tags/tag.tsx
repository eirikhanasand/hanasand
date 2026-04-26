import prettyDate from '@/utils/date/prettyDate'
import smallDate from '@/utils/date/smallDate'
import { Bug, CloudCheck, Cpu, Info, MemoryStick, Pencil, RefreshCcw, StopCircle, TriangleAlert } from 'lucide-react'

type Color = 'red' | 'green' | 'orange' | 'lightgreen' | 'blue' | 'yellow' | 'default' | 'none' | 'dynamic'
type Icon = 'ram' | 'cpu' | 'refresh' | 'error' | 'warning' | 'success' | 'pencil'
type Map = Record<string, { color: Color, icon: Icon }>
type TagProps = {
    icon?: Icon
    text: string
    date?: 'minimal' | 'full'
    color?: Color
    map?: Map
}

export default function Tag({ icon, text, date, color, map }: TagProps) {
    const minimal = date ? date === 'minimal' ? smallDate(text) : prettyDate(text) : null
    const output = date ? minimal : text
    const colorClass = color === 'dynamic' ? colorMap(text, map) : Color(color)
    const iconValue = color === 'dynamic' ? getMapIcon(text, map) : icon
    const Icon = getIcon(iconValue)

    return (
        <div className={`flex w-fit gap-1 items-center px-1.5 py-px rounded-sm m-px text-xs ${colorClass}`}>
            {iconValue && <span>{Icon}</span>}
            <span className='text-bright/70'>{output}</span>
        </div>
    )
}

function getIcon(icon: string | undefined) {
    const smallIconClass = 'w-3 h-3 stroke-bright/70'

    switch (icon) {
        case 'ram': return <MemoryStick className={smallIconClass} />
        case 'cpu': return <Cpu className={smallIconClass} />
        case 'refresh': return <RefreshCcw className={smallIconClass} />
        case 'error': return <StopCircle className={smallIconClass} />
        case 'warning': return <TriangleAlert className={smallIconClass} />
        case 'success': return <CloudCheck className={smallIconClass} />
        case 'bug': return <Bug className={smallIconClass} />
        case 'pencil': return <Pencil className={smallIconClass} />
        default: return <Info className={smallIconClass} />
    }
}

function getMapIcon(value?: string, map?: Map) {
    if (!value || !map) {
        return
    }

    const iconKey = map[value.toLowerCase()] || 'default'
    return iconKey.icon
}

function colorMap(value?: string, map?: Map) {
    if (!value || !map) {
        return Color('default')
    }

    const colorKey = map[value.toLowerCase()] || 'default'
    return Color(colorKey.color)
}

function Color(input: string | undefined) {
    switch (input) {
        case 'red':         return 'outline outline-red-500/40    bg-red-500/20'
        case 'green':       return 'outline outline-green-500/40  bg-green-500/20'
        case 'yellow':      return 'outline outline-yellow-500/40 bg-yellow-500/20'
        case 'orange':      return 'outline outline-orange-500/40 bg-orange-500/20'
        case 'lightgreen':  return 'outline outline-green-400/40  bg-green-400/20'
        case 'blue':        return 'outline outline-blue-400/40   bg-blue-400/20'
        default:            return 'outline outline-blue-400/40   bg-blue-400/20'
    }
}
