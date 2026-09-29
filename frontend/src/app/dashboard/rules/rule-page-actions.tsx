import Button from '@/components/misc/button'
import { Filter, ListFilter } from 'lucide-react'
import { ruleCategories, type RuleCategory } from './rule-categories'

type RulePageActionsProps = {
    category: RuleCategory
    showCreate: boolean
    showImports: boolean
    onToggleCreate: () => void
    onToggleImports: () => void
    showFilters: boolean
    showDisabled: boolean
    disabledCount: number
    onToggleFilters: () => void
    onToggleDisabled: () => void
}

export default function RulePageActions({ category, showCreate, showImports, showFilters, showDisabled, disabledCount, onToggleCreate, onToggleImports, onToggleFilters, onToggleDisabled }: RulePageActionsProps) {
    const otherCategories = (Object.keys(ruleCategories) as RuleCategory[]).filter(value => value !== category)
    const navigationLabels: Record<RuleCategory, string> = { analysis: 'Analysis rules', match: 'Match rules', detection: 'Detection rules' }
    return (
        <div className='flex max-w-full flex-wrap items-center gap-3'>
            <Button
                text='Create'
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
                aria-expanded={showCreate}
                aria-controls='event-rule-create'
                onClick={onToggleCreate}
            />
            <Button
                text='Import'
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
                aria-expanded={showImports}
                aria-controls='event-rule-imports'
                onClick={onToggleImports}
            />
            {otherCategories.map(value => <Button
                key={value}
                text={navigationLabels[value]}
                path={`/rules/${value}`}
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
            />)}
            <Button
                text={showDisabled ? 'Hide disabled' : 'Show disabled'}
                icon={<span className='rounded-full bg-ui-raised px-1.5 py-0.5 text-[10px] leading-none text-ui-muted'>{disabledCount}</span>}
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
                aria-pressed={showDisabled}
                onClick={onToggleDisabled}
            />
            {category === 'analysis' ? <button
                type='button'
                aria-label={showFilters ? 'Hide filters' : 'Show filters'}
                title={showFilters ? 'Hide filters' : 'Show filters'}
                aria-expanded={showFilters}
                aria-controls='event-rule-filters'
                onClick={onToggleFilters}
                className='inline-flex h-10 w-10 items-center justify-center rounded-md text-ui-text hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'
            >
                <ListFilter className='h-4 w-4' aria-hidden='true' />
            </button> : <Button
                text='Filters'
                icon={<Filter className='h-4 w-4' />}
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
                aria-expanded={showFilters}
                aria-controls='event-rule-filters'
                onClick={onToggleFilters}
            />}
        </div>
    )
}
