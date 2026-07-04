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
        <div className={`m-px flex w-fit items-center gap-1 rounded-sm px-1.5 py-px text-xs ${colorClass}`}>
            {iconValue && <span>{Icon}</span>}
            <span>{output}</span>
        </div>
    )
}

function getIcon(icon: string | undefined) {
    const smallIconClass = 'h-3 w-3 stroke-current'

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
        case 'red':         return 'border border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
        case 'green':       return 'border border-ui-success/30 bg-ui-success/10 text-ui-success'
        case 'yellow':      return 'border border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
        case 'orange':      return 'border border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
        case 'lightgreen':  return 'border border-ui-success/30 bg-ui-success/10 text-ui-success'
        case 'blue':        return 'border border-ui-primary/30 bg-ui-primary/10 text-ui-primary'
        default:            return 'border border-ui-primary/30 bg-ui-primary/10 text-ui-primary'
    }
}
