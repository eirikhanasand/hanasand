import Button from '@/components/misc/button'
import { ruleCategories, type RuleCategory } from './rule-categories'

type RulePageActionsProps = {
    category: RuleCategory
    organizationId: string
    showCreate: boolean
    showImports: boolean
    onToggleCreate: () => void
    onToggleImports: () => void
}

export default function RulePageActions({ category, organizationId, showCreate, showImports, onToggleCreate, onToggleImports }: RulePageActionsProps) {
    const otherCategories = (Object.keys(ruleCategories) as RuleCategory[]).filter(value => value !== category)
    const organizationQuery = `?organizationId=${encodeURIComponent(organizationId)}`

    return (
        <div className='flex max-w-full flex-wrap items-center gap-3'>
            <Button
                text='Create'
                variant='secondary'
                className='h-10 px-4 text-sm font-semibold'
                aria-expanded={showCreate}
                aria-controls='event-rule-create'
                onClick={onToggleCreate}
            />
            <Button
                text='Import'
                variant='secondary'
                className='h-10 px-4 text-sm font-semibold'
                aria-expanded={showImports}
                aria-controls='event-rule-imports'
                onClick={onToggleImports}
            />
            {otherCategories.map(value => <Button key={value} text={ruleCategories[value].label} path={`/rules/${value}${organizationQuery}`} variant='secondary' className='h-10 px-4 text-sm font-semibold' />)}
        </div>
    )
}
